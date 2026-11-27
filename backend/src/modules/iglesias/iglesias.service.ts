import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoIglesia,
  EstadoTarea,
  OrigenIglesia,
  PlanIglesia,
  Prisma,
  Rol,
  TipoNotificacion,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { PLAN_LIMITS, esPlanDePago } from '../../common/constants/plan';
import { bucketPorMes, inicioVentanaMensual } from '../../common/utils/bucket-por-mes.util';
import { estadoFacturacionDe, sumarDias, sumarUnMes } from '../../common/utils/calcular-facturacion';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { AuthService } from '../auth/auth.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';
import { sincronizarPerfilRed } from '../red/perfil-red.sync';
import { ActualizarFacturacionDto } from './dto/actualizar-facturacion.dto';
import { CambiarPlanDto } from './dto/cambiar-plan.dto';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { LOGO_RESIZE, resolverExtensionLogo } from './logo-upload.config';

/** Días entre la fecha de adquisición del plan y la primera facturación (ver CreateIglesiaDto). */
const DIAS_PRIMERA_FACTURACION = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MESES_VENTANA_CERTIFICADOS = 6;

export interface FiltrosIglesias {
  search?: string;
  estado?: EstadoIglesia;
  plan?: PlanIglesia;
  region?: string;
  verificada?: boolean;
  origen?: OrigenIglesia;
}

const LISTADO_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  logoUrl: true,
  estado: true,
  plan: true,
  planPrevioMora: true,
  origen: true,
  verificada: true,
  proximaFacturacion: true,
  createdAt: true,
  usuarios: {
    select: { nombre: true, apellido: true, email: true },
    where: { rol: Rol.MANAGER },
    take: 1,
  },
} as const;

const DETALLE_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  plan: true,
  planPrevioMora: true,
  origen: true,
  verificada: true,
  verificadaEn: true,
  proximaFacturacion: true,
  ultimoPagoAt: true,
  visitantesPromedio: true,
  createdAt: true,
  usuarios: {
    select: {
      id: true,
      username: true,
      email: true,
      nombre: true,
      apellido: true,
      rol: true,
      activo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

@Injectable()
export class IglesiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService,
    private readonly authService: AuthService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Crea la iglesia y su manager (dueño del tenant) en una sola transacción —
   * una iglesia sin manager a cargo no tiene sentido en este modelo. La
   * contraseña temporal se devuelve una sola vez, igual que con el resto del equipo.
   * El logo se sube a Storage antes de abrir la transacción: es una llamada de red,
   * no debe mantener la transacción de Prisma abierta mientras espera.
   *
   * `proximaFacturacion` ya no la elige el SuperAdmin a mano: se calcula desde
   * `fechaAdquisicionPlan` + 30 días. Esa misma fecha queda como el primer registro
   * del historial de pagos de la iglesia (ver `historialPagos`) — adquirir el plan
   * es, en los hechos, el primer "pago" confirmado.
   */
  async create(dto: CreateIglesiaDto, superAdminId: string, logo?: Express.Multer.File) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const fechaAdquisicionPlan = new Date(dto.fechaAdquisicionPlan);
    const proximaFacturacion = sumarDias(fechaAdquisicionPlan, DIAS_PRIMERA_FACTURACION);
    const logoUrl = logo
      ? await this.supabaseStorage.upload(
          'logos-iglesias',
          `${randomUUID()}${resolverExtensionLogo(logo.mimetype)}`,
          logo,
          LOGO_RESIZE,
        )
      : undefined;

    try {
      const { iglesia, pastor } = await this.prisma.withTenantTransaction(async (tx) => {
        const iglesia = await tx.iglesia.create({
          data: {
            nombre: dto.nombre,
            comuna: dto.comuna,
            region: dto.region,
            direccion: dto.direccion,
            plan: dto.plan,
            proximaFacturacion,
            logoUrl,
            // Alta por el SuperAdmin = contacto comercial: nace verificada en la red.
            verificada: true,
            verificadaEn: new Date(),
          },
        });

        const pastor = await tx.usuario.create({
          data: {
            username: dto.pastorUsername,
            email: dto.pastorEmail,
            password: passwordHash,
            nombre: dto.pastorNombre,
            apellido: dto.pastorApellido,
            rol: Rol.MANAGER,
            iglesiaId: iglesia.id,
            mustChangePassword: true,
            onboardingCompletado: false,
          },
          select: { id: true, username: true, email: true, nombre: true, apellido: true },
        });

        await tx.pagoIglesia.create({
          data: { iglesiaId: iglesia.id, fecha: fechaAdquisicionPlan, registradoPorId: superAdminId },
        });

        await sincronizarPerfilRed(tx, iglesia.id);

        return { iglesia, pastor };
      });

      return { iglesia, pastor, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
  }

  /**
   * Listado filtrable para la página "Iglesias" del SuperAdmin (búsqueda por nombre +
   * filtros de estado/plan/región). Sin paginación: el volumen de iglesias es bajo y
   * ningún otro listado del backend pagina hoy — no introducir el patrón solo acá.
   */
  async findAll(filtros: FiltrosIglesias) {
    const where: Prisma.IglesiaWhereInput = {
      ...(filtros.search ? { nombre: { contains: filtros.search, mode: 'insensitive' } } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.plan ? { plan: filtros.plan } : {}),
      ...(filtros.region ? { region: filtros.region } : {}),
      ...(filtros.verificada !== undefined ? { verificada: filtros.verificada } : {}),
      ...(filtros.origen ? { origen: filtros.origen } : {}),
    };

    const iglesias = await this.prisma.iglesia.findMany({
      where,
      select: LISTADO_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return iglesias.map((i) => this.mapListado(i));
  }

  private mapListado(iglesia: Prisma.IglesiaGetPayload<{ select: typeof LISTADO_SELECT }>) {
    const { usuarios, proximaFacturacion, ...resto } = iglesia;
    return {
      ...resto,
      pastor: usuarios[0] ?? null,
      // null en plan GRATUITO (no paga, no tiene semáforo ni mora).
      facturacion: estadoFacturacionDe(iglesia.plan, proximaFacturacion),
    };
  }

  /**
   * Fase 5 de docs/supabase.md: avisa al dashboard del SuperAdmin (room
   * `superadmin`, ver RealtimeGateway) cada vez que cambia el EstadoIglesia o
   * la proximaFacturacion de una iglesia — los 2 campos que ese dashboard
   * necesita en vivo. Mismo shape que un item de `findAll` para que el
   * frontend pueda parchear la fila sin tener que volver a pedir la lista.
   */
  private async emitIglesiaActualizada(id: string): Promise<void> {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: LISTADO_SELECT });
    if (!iglesia) {
      return;
    }
    this.realtimeService.emitASuperAdmin(REALTIME_EVENTS.IGLESIA_ACTUALIZADA, this.mapListado(iglesia));
  }

  /**
   * Detalle para el SuperAdmin: la iglesia, quién es el manager, el resto del
   * equipo, el semáforo de facturación (ver calcularEstadoFacturacion) y el uso
   * actual contra los topes del plan contratado.
   */
  async findOne(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: DETALLE_SELECT });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return this.buildDetalle(iglesia);
  }

  /**
   * Cambiar de plan nunca borra ni desactiva datos existentes — solo mueve los topes
   * hacia delante (y, desde GRATUITO, desbloquea los módulos de pago).
   *
   * Pasar de GRATUITO a un plan de pago es "contratar": si la iglesia no tiene una fecha
   * de facturación vigente se fija hoy + 30 días con su registro en el historial de
   * pagos (igual que el alta), y queda verificada en la red.
   */
  async cambiarPlan(id: string, dto: CambiarPlanDto, superAdminId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { plan: true, proximaFacturacion: true },
    });
    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const contrata = iglesia.plan === PlanIglesia.GRATUITO && esPlanDePago(dto.plan);
    const ahora = new Date();

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.iglesia.update({
        where: { id },
        data: {
          plan: dto.plan,
          // Un cambio manual de plan cierra cualquier degradación por mora pendiente.
          planPrevioMora: null,
          ...(contrata
            ? {
                proximaFacturacion: sumarDias(ahora, DIAS_PRIMERA_FACTURACION),
                ultimoPagoAt: ahora,
                verificada: true,
                verificadaEn: ahora,
              }
            : {}),
        },
      });
      if (contrata) {
        await tx.pagoIglesia.create({ data: { iglesiaId: id, fecha: ahora, registradoPorId: superAdminId } });
      }
      await sincronizarPerfilRed(tx, id);
    });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /** Insignia "verificada" de la red (SuperAdmin). Ver docs/red-de-iglesias.md. */
  async verificar(id: string, verificada: boolean) {
    await this.requireExists(id);

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.iglesia.update({
        where: { id },
        data: { verificada, verificadaEn: verificada ? new Date() : null },
      });
      await sincronizarPerfilRed(tx, id);
    });

    if (verificada) {
      await this.notificarAlEquipo(id, {
        tipo: TipoNotificacion.IGLESIA_VERIFICADA,
        titulo: 'Tu iglesia fue verificada',
        mensaje: 'Tu iglesia ahora muestra la insignia de verificada en la Red de iglesias.',
        url: '/red/perfil',
      });
    }

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /**
   * Mora → plan GRATUITO (decisión del fundador, 2026-11-26): en vez de bloquear el
   * acceso, la iglesia conserva sus datos y la Red de iglesias, pero pierde los módulos
   * de pago hasta ponerse al día. Guarda el plan que tenía para restaurarlo en
   * `marcarPagada`. La llama FacturacionRecordatoriosCron al cumplirse DIAS_GRACIA_MORA.
   * Devuelve false si no correspondía (ya gratuita, o sin mora suficiente).
   */
  async degradarPorMora(id: string): Promise<boolean> {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { plan: true, proximaFacturacion: true },
    });
    if (!iglesia) {
      return false;
    }
    const facturacion = estadoFacturacionDe(iglesia.plan, iglesia.proximaFacturacion);
    if (!facturacion?.puedeOcultar) {
      return false;
    }

    await this.prisma.iglesia.update({
      where: { id },
      data: { planPrevioMora: iglesia.plan, plan: PlanIglesia.GRATUITO, estado: EstadoIglesia.ACTIVA },
    });

    await this.notificarAlEquipo(id, {
      tipo: TipoNotificacion.PLAN_DEGRADADO,
      titulo: 'Tu iglesia pasó al plan gratuito',
      mensaje:
        'La mensualidad lleva varios días vencida. Tus datos siguen guardados: al ponerte al día recuperas tu plan y todos los módulos.',
      url: '/facturacion',
    });

    await this.emitIglesiaActualizada(id);
    return true;
  }

  /** Aviso en la campana a todo el equipo activo de una iglesia (corre como SuperAdmin o servicio). */
  private async notificarAlEquipo(
    iglesiaId: string,
    aviso: { tipo: TipoNotificacion; titulo: string; mensaje: string; url: string },
  ): Promise<void> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { iglesiaId, activo: true },
      select: { id: true },
    });
    if (usuarios.length === 0) {
      return;
    }
    await this.prisma.notificacion.createMany({
      data: usuarios.map((u) => ({ ...aviso, usuarioId: u.id, iglesiaId })),
    });
    this.realtimeService.emitAIglesia(iglesiaId, REALTIME_EVENTS.NOTIFICACION_NUEVA, { tipo: aviso.tipo });
  }

  /**
   * Corrección manual de la fecha de facturación (no confundir con `marcarPagada`, que
   * además la avanza y queda en el historial). Exige reingresar la contraseña del
   * SuperAdmin (ver ActualizarFacturacionDto) — cambia cuándo se corta el acceso de una
   * iglesia por mora, no es una edición trivial. No genera entrada de historial de
   * pagos: es una corrección de dato, no una confirmación de pago.
   */
  async actualizarFacturacion(id: string, dto: ActualizarFacturacionDto, superAdminId: string) {
    await this.requireExists(id);
    await this.authService.verifyPassword(superAdminId, dto.password);

    await this.prisma.iglesia.update({
      where: { id },
      data: { proximaFacturacion: new Date(dto.proximaFacturacion) },
    });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /**
   * Confirmación manual de pago (no hay pasarela todavía): avanza la fecha de
   * facturación un mes exacto desde la fecha vencida (no desde "hoy"), reactiva la
   * iglesia si estaba oculta por mora, y deja un registro en el historial de pagos.
   */
  async marcarPagada(id: string, superAdminId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true, plan: true, planPrevioMora: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    // Degradada por mora: el pago le devuelve su plan anterior. Como pasó días sin
    // módulos de pago, el nuevo ciclo se cuenta desde hoy (no desde la fecha vencida).
    const restaura = iglesia.planPrevioMora;
    if (iglesia.plan === PlanIglesia.GRATUITO && !restaura) {
      throw new BadRequestException(
        'La iglesia está en el plan gratuito y no tiene un plan que restaurar: usa "Cambiar plan" para contratarle uno.',
      );
    }

    const fechaPago = new Date();
    const base = restaura || !iglesia.proximaFacturacion ? fechaPago : iglesia.proximaFacturacion;

    await this.prisma.withTenantTransaction(async (tx) => {
      await tx.iglesia.update({
        where: { id },
        data: {
          proximaFacturacion: sumarUnMes(base),
          ultimoPagoAt: fechaPago,
          estado: EstadoIglesia.ACTIVA,
          ...(restaura ? { plan: restaura, planPrevioMora: null } : {}),
        },
      });
      await tx.pagoIglesia.create({
        data: { iglesiaId: id, fecha: fechaPago, registradoPorId: superAdminId },
      });
    });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /** Historial de pagos/confirmaciones de facturación de la iglesia, más reciente primero. */
  async historialPagos(id: string) {
    await this.requireExists(id);

    return this.prisma.pagoIglesia.findMany({
      where: { iglesiaId: id },
      orderBy: { fecha: 'desc' },
      select: {
        id: true,
        fecha: true,
        createdAt: true,
        registradoPor: { select: { id: true, nombre: true, apellido: true } },
      },
    });
  }

  /**
   * Oculta la iglesia (bloquea login y sesiones activas de todo su equipo, ver
   * AuthService/JwtAuthGuard). Solo disponible con 3+ días de mora — reforzado acá
   * también, no solo en el frontend (ver DIAS_GRACIA_MORA).
   */
  async ocultar(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true, plan: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const puedeOcultar = estadoFacturacionDe(iglesia.plan, iglesia.proximaFacturacion)?.puedeOcultar ?? false;
    if (!puedeOcultar) {
      throw new ForbiddenException(
        'Solo se puede ocultar una iglesia con 3 o más días de mora en su facturación.',
      );
    }

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.SUSPENDIDA } });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  /** Reactivación manual — siempre disponible (ej. el SuperAdmin ocultó por error). */
  async mostrar(id: string) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.ACTIVA } });

    await this.emitIglesiaActualizada(id);
    return this.findOne(id);
  }

  private async requireExists(id: string): Promise<void> {
    const iglesia = await this.prisma.iglesia.findUnique({ where: { id }, select: { id: true } });
    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }
  }

  private async buildDetalle(iglesia: Prisma.IglesiaGetPayload<{ select: typeof DETALLE_SELECT }>) {
    const { usuarios, plan, proximaFacturacion, ...iglesiaData } = iglesia;

    const iglesiaId = iglesia.id;
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - MS_POR_DIA);
    const hace7d = new Date(ahora.getTime() - 7 * MS_POR_DIA);
    const en30d = new Date(ahora.getTime() + 30 * MS_POR_DIA);
    const desdeVentanaCertificados = inicioVentanaMensual(MESES_VENTANA_CERTIFICADOS, ahora);
    const certificadoWhereReciente = { iglesiaId, createdAt: { gte: desdeVentanaCertificados } };

    const [
      departamentosActuales,
      usuariosActivosHoy,
      usuariosActivosSemana,
      eventosTotal,
      eventosProximos30d,
      integrantesTotal,
      matrimonios,
      bautizos,
      defunciones,
      presentaciones,
      matrimoniosRecientes,
      bautizosRecientes,
      defuncionesRecientes,
      presentacionesRecientes,
      notasPendientes,
    ] = await Promise.all([
      this.prisma.departamentoFinanciero.count({ where: { iglesiaId, activo: true } }),
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace24h } } }),
      this.prisma.usuario.count({ where: { iglesiaId, ultimoAccesoAt: { gte: hace7d } } }),
      this.prisma.evento.count({ where: { iglesiaId } }),
      this.prisma.evento.count({ where: { iglesiaId, fechaInicio: { gte: ahora, lte: en30d } } }),
      this.prisma.integrante.count({ where: { iglesiaId } }),
      this.prisma.matrimonio.count({ where: { iglesiaId } }),
      this.prisma.bautizo.count({ where: { iglesiaId } }),
      this.prisma.defuncion.count({ where: { iglesiaId } }),
      this.prisma.presentacion.count({ where: { iglesiaId } }),
      this.prisma.matrimonio.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.bautizo.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.defuncion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.presentacion.findMany({ where: certificadoWhereReciente, select: { createdAt: true } }),
      this.prisma.nota.count({
        where: { iglesiaId, estado: { not: EstadoTarea.COMPLETADA }, archivado: false },
      }),
    ]);

    const usuariosActuales = usuarios.filter(
      (u) => u.activo && (u.rol === Rol.MANAGER || u.rol === Rol.USUARIO),
    ).length;

    const limitesPlan = PLAN_LIMITS[plan];

    const fechasCertificadosRecientes = [
      ...matrimoniosRecientes,
      ...bautizosRecientes,
      ...defuncionesRecientes,
      ...presentacionesRecientes,
    ].map((r) => r.createdAt);

    return {
      ...iglesiaData,
      plan,
      pastor: usuarios.find((u) => u.rol === Rol.MANAGER) ?? null,
      equipo: usuarios.filter((u) => u.rol !== Rol.MANAGER),
      facturacion: estadoFacturacionDe(plan, proximaFacturacion),
      limites: {
        usuarios: { actuales: usuariosActuales, maximo: limitesPlan.maxUsuarios },
        departamentosFinancieros: {
          actuales: departamentosActuales,
          maximo: limitesPlan.maxDepartamentosFinancieros,
        },
      },
      // KPIs de adopción/uso para el SuperAdmin — deliberadamente sin nada financiero
      // (montos, movimientos, categorías): ver CLAUDE.md, el SuperAdmin no ve el detalle
      // financiero/operativo interno de una iglesia.
      estadisticas: {
        usuariosActivosHoy,
        usuariosActivosSemana,
        eventos: { total: eventosTotal, proximos30d: eventosProximos30d },
        integrantesTotal,
        certificados: {
          total: matrimonios + bautizos + defunciones + presentaciones,
          porTipo: { matrimonios, bautizos, defunciones, presentaciones },
          porMes: bucketPorMes(fechasCertificadosRecientes, MESES_VENTANA_CERTIFICADOS, ahora),
        },
        notasPendientes,
      },
    };
  }
}
