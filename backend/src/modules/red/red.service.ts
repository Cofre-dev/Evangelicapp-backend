import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoAlianza,
  EstadoCompromiso,
  EstadoLlamado,
  Prisma,
  TipoNotificacion,
  VisibilidadLlamado,
} from '@prisma/client';
import { PLAN_LIMITS, PLAN_LABEL } from '../../common/constants/plan';
import { resolverComuna } from '../../common/constants/chile-regiones';
import { runAsService } from '../../common/context/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime-rooms.util';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AlcanceFeed,
  CreateCompromisoDto,
  CreateLlamadoDto,
  DirectorioQueryDto,
  UpdateLlamadoDto,
  UpdatePerfilRedDto,
} from './dto/red.dto';
import { sincronizarPerfilRed } from './perfil-red.sync';
import { RedAvisosService } from './red-avisos.service';
import { calcularProgreso, coberturaCompleta } from './red.util';

const POR_PAGINA = 20;
const ESTADOS_ACTIVOS: EstadoLlamado[] = [EstadoLlamado.ABIERTO, EstadoLlamado.CUBIERTO];

const PERFIL_PUBLICO_SELECT = {
  iglesiaId: true,
  nombre: true,
  comuna: true,
  region: true,
  logoUrl: true,
  verificada: true,
} satisfies Prisma.PerfilRedSelect;

export type PerfilPublico = Prisma.PerfilRedGetPayload<{ select: typeof PERFIL_PUBLICO_SELECT }>;

const LLAMADO_INCLUDE = {
  necesidades: { orderBy: { orden: 'asc' } },
  compromisos: {
    where: { estado: EstadoCompromiso.ACTIVO },
    select: { id: true, iglesiaId: true, necesidadId: true, cantidad: true, mensaje: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.LlamadoAyudaInclude;

type LlamadoConDetalle = Prisma.LlamadoAyudaGetPayload<{ include: typeof LLAMADO_INCLUDE }>;

export type EstadoAlianzaVista = 'ACEPTADA' | 'PENDIENTE_ENVIADA' | 'PENDIENTE_RECIBIDA' | 'RECHAZADA' | null;

/**
 * Red de iglesias: perfil, directorio, llamados de ayuda y compromisos ("¡Yo te
 * ayudo!"). Ver docs/red-de-iglesias.md.
 *
 * Seguridad: todo corre con el contexto de tenant del request, así que RLS decide qué
 * filas de OTRAS iglesias se ven (perfiles, llamados visibles, sus necesidades y
 * compromisos) y garantiza que solo se escriba lo propio. Los únicos bypass
 * (`runAsService`) son puntuales y escriben sobre el llamado de otra iglesia como
 * consecuencia de una acción legítima (pasarlo a CUBIERTO / ABIERTO según los apoyos),
 * más los avisos (RedAvisosService). Nunca se lee la tabla `iglesias` de otra iglesia:
 * su cara pública es `perfiles_red`.
 */
@Injectable()
export class RedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: RedAvisosService,
    private readonly realtimeService: RealtimeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Perfil propio
  // ---------------------------------------------------------------------------

  async getMiPerfil(iglesiaId: string) {
    let perfil = await this.prisma.perfilRed.findUnique({ where: { iglesiaId } });
    if (!perfil) {
      await sincronizarPerfilRed(this.prisma, iglesiaId);
      perfil = await this.prisma.perfilRed.findUniqueOrThrow({ where: { iglesiaId } });
    }
    return perfil;
  }

  async updateMiPerfil(iglesiaId: string, dto: UpdatePerfilRedDto) {
    await this.getMiPerfil(iglesiaId);
    return this.prisma.perfilRed.update({
      where: { iglesiaId },
      data: {
        descripcion: dto.descripcion,
        emailContacto: dto.emailContacto,
        telefonoContacto: dto.telefonoContacto,
        sitioWeb: dto.sitioWeb,
        visible: dto.visible,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Directorio
  // ---------------------------------------------------------------------------

  async directorio(iglesiaId: string, query: DirectorioQueryDto) {
    const pagina = query.pagina ?? 1;
    const where: Prisma.PerfilRedWhereInput = {
      visible: true,
      iglesiaId: { not: iglesiaId },
      ...(query.region ? { region: query.region } : {}),
      ...(query.comuna ? { comuna: query.comuna } : {}),
      ...(query.q ? { nombre: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const [perfiles, total, alianzas] = await Promise.all([
      this.prisma.perfilRed.findMany({
        where,
        orderBy: [{ verificada: 'desc' }, { nombre: 'asc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: { ...PERFIL_PUBLICO_SELECT, descripcion: true },
      }),
      this.prisma.perfilRed.count({ where }),
      this.alianzasPropias(iglesiaId),
    ]);

    return {
      items: perfiles.map((p) => ({
        ...p,
        alianza: this.estadoAlianzaCon(iglesiaId, p.iglesiaId, alianzas),
      })),
      total,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Perfil de otra iglesia + sus llamados activos que esta iglesia puede ver. Si el
   * perfil no está en el directorio (`visible = false`) igual se muestra cuando la otra
   * iglesia ya interactuó en la red (es aliada, o tiene un llamado visible para ti).
   */
  async perfilDeIglesia(iglesiaId: string, otraIglesiaId: string) {
    const perfil = await this.prisma.perfilRed.findUnique({
      where: { iglesiaId: otraIglesiaId },
      select: {
        ...PERFIL_PUBLICO_SELECT,
        descripcion: true,
        emailContacto: true,
        telefonoContacto: true,
        sitioWeb: true,
        visible: true,
      },
    });
    if (!perfil) {
      throw new NotFoundException('Iglesia no encontrada en la red');
    }

    const [llamados, alianzas] = await Promise.all([
      this.prisma.llamadoAyuda.findMany({
        where: { iglesiaId: otraIglesiaId, estado: { in: ESTADOS_ACTIVOS }, ocultoModeracion: false },
        include: LLAMADO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.alianzasPropias(iglesiaId),
    ]);
    const alianza = this.estadoAlianzaCon(iglesiaId, otraIglesiaId, alianzas);

    if (!perfil.visible && otraIglesiaId !== iglesiaId && llamados.length === 0 && alianza === null) {
      throw new NotFoundException('Iglesia no encontrada en la red');
    }

    const { visible: _visible, ...publico } = perfil;
    const perfiles = new Map([[otraIglesiaId, publico]]);
    return {
      ...publico,
      alianza,
      llamados: llamados.map((l) => this.resumenLlamado(l, iglesiaId, perfiles)),
    };
  }

  // ---------------------------------------------------------------------------
  // Feed y llamados
  // ---------------------------------------------------------------------------

  async feed(
    iglesiaId: string,
    opciones: {
      alcance?: AlcanceFeed;
      incluirCerrados?: boolean;
      tipo?: Prisma.LlamadoAyudaWhereInput['tipo'];
      pagina?: number;
    },
  ) {
    const yo = await this.miUbicacion(iglesiaId);
    const pagina = opciones.pagina ?? 1;

    // Qué le corresponde ver a esta iglesia según la visibilidad de cada llamado. Los
    // ALIADAS ya vienen filtrados por RLS (solo los de iglesias aliadas).
    const visibleParaMi: Prisma.LlamadoAyudaWhereInput = {
      OR: [
        { visibilidad: VisibilidadLlamado.NACIONAL },
        { visibilidad: VisibilidadLlamado.REGION, region: yo.region },
        { visibilidad: VisibilidadLlamado.COMUNA, region: yo.region, comuna: yo.comuna },
        { visibilidad: VisibilidadLlamado.ALIADAS },
      ],
    };
    const porAlcance: Record<AlcanceFeed, Prisma.LlamadoAyudaWhereInput> = {
      TODO: visibleParaMi,
      COMUNA: { AND: [visibleParaMi, { region: yo.region, comuna: yo.comuna }] },
      REGION: { AND: [visibleParaMi, { region: yo.region }] },
      NACIONAL: { visibilidad: VisibilidadLlamado.NACIONAL },
      ALIADAS: { visibilidad: VisibilidadLlamado.ALIADAS },
    };

    const where: Prisma.LlamadoAyudaWhereInput = {
      AND: [
        porAlcance[opciones.alcance ?? 'TODO'],
        { iglesiaId: { not: iglesiaId }, ocultoModeracion: false },
        opciones.incluirCerrados ? {} : { estado: { in: ESTADOS_ACTIVOS } },
        opciones.tipo ? { tipo: opciones.tipo } : {},
      ],
    };

    const [llamados, total] = await Promise.all([
      this.prisma.llamadoAyuda.findMany({
        where,
        include: LLAMADO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
      this.prisma.llamadoAyuda.count({ where }),
    ]);

    const perfiles = await this.perfilesDe(llamados.map((l) => l.iglesiaId));
    return {
      items: llamados.map((l) => this.resumenLlamado(l, iglesiaId, perfiles)),
      total,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  async misLlamados(iglesiaId: string) {
    const llamados = await this.prisma.llamadoAyuda.findMany({
      where: { iglesiaId },
      include: LLAMADO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const perfiles = await this.perfilesDe([
      iglesiaId,
      ...llamados.flatMap((l) => l.compromisos.map((c) => c.iglesiaId)),
    ]);
    return llamados.map((l) => this.detalleLlamado(l, iglesiaId, perfiles));
  }

  async getLlamado(iglesiaId: string, id: string) {
    const llamado = await this.llamadoVisibleOrThrow(id);
    const perfiles = await this.perfilesDe([
      llamado.iglesiaId,
      ...llamado.compromisos.map((c) => c.iglesiaId),
    ]);
    return this.detalleLlamado(llamado, iglesiaId, perfiles);
  }

  async crearLlamado(iglesiaId: string, usuarioId: string, dto: CreateLlamadoDto) {
    const yo = await this.miUbicacion(iglesiaId);
    await this.verificarCupoLlamados(iglesiaId, yo.plan);

    let ubicacion = { region: yo.region, comuna: yo.comuna };
    if (dto.region !== undefined || dto.comuna !== undefined) {
      const resuelta = dto.region && dto.comuna ? resolverComuna(dto.region, dto.comuna) : null;
      if (!resuelta) {
        throw new BadRequestException('Indica una región y una comuna válidas (del catálogo)');
      }
      ubicacion = resuelta;
    }
    this.validarFechas(dto.fechaInicio, dto.fechaFin);

    const llamado = await this.prisma.llamadoAyuda.create({
      data: {
        iglesiaId,
        creadoPorId: usuarioId,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        tipo: dto.tipo,
        visibilidad: dto.visibilidad,
        region: ubicacion.region,
        comuna: ubicacion.comuna,
        direccion: dto.direccion,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
        necesidades: {
          create: (dto.necesidades ?? []).map((n, orden) => ({
            descripcion: n.descripcion,
            tipo: n.tipo,
            cantidadMeta: n.cantidadMeta,
            unidad: n.unidad,
            orden,
          })),
        },
      },
      include: LLAMADO_INCLUDE,
    });

    void this.avisarLlamadoNuevo(llamado, yo.nombre);

    const perfiles = await this.perfilesDe([iglesiaId]);
    return this.detalleLlamado(llamado, iglesiaId, perfiles);
  }

  async actualizarLlamado(iglesiaId: string, id: string, dto: UpdateLlamadoDto) {
    const llamado = await this.llamadoPropioOrThrow(iglesiaId, id);
    this.validarFechas(
      dto.fechaInicio === undefined ? llamado.fechaInicio?.toISOString() : (dto.fechaInicio ?? undefined),
      dto.fechaFin === undefined ? llamado.fechaFin?.toISOString() : (dto.fechaFin ?? undefined),
    );

    await this.prisma.llamadoAyuda.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        direccion: dto.direccion,
        fechaInicio:
          dto.fechaInicio === undefined ? undefined : dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFin: dto.fechaFin === undefined ? undefined : dto.fechaFin ? new Date(dto.fechaFin) : null,
      },
    });
    return this.getLlamado(iglesiaId, id);
  }

  /** ABIERTO / CUBIERTO / CERRADO a mano por la dueña. Reabrir un CERRADO cuenta para el cupo del plan. */
  async cambiarEstadoLlamado(iglesiaId: string, id: string, estado: EstadoLlamado) {
    const llamado = await this.llamadoPropioOrThrow(iglesiaId, id);
    if (llamado.estado === estado) {
      return this.getLlamado(iglesiaId, id);
    }
    if (llamado.estado === EstadoLlamado.CERRADO) {
      const { plan } = await this.miUbicacion(iglesiaId);
      await this.verificarCupoLlamados(iglesiaId, plan);
    }

    await this.prisma.llamadoAyuda.update({
      where: { id },
      data: { estado, cerradoEn: estado === EstadoLlamado.CERRADO ? new Date() : null },
    });
    return this.getLlamado(iglesiaId, id);
  }

  // ---------------------------------------------------------------------------
  // Compromisos ("¡Yo te ayudo!")
  // ---------------------------------------------------------------------------

  async comprometer(iglesiaId: string, usuarioId: string, llamadoId: string, dto: CreateCompromisoDto) {
    const llamado = await this.llamadoVisibleOrThrow(llamadoId);
    if (llamado.iglesiaId === iglesiaId) {
      throw new BadRequestException('No puedes apoyar un llamado de tu propia iglesia');
    }
    if (llamado.estado === EstadoLlamado.CERRADO) {
      throw new BadRequestException('Este llamado ya está cerrado');
    }
    if (dto.necesidadId && !llamado.necesidades.some((n) => n.id === dto.necesidadId)) {
      throw new BadRequestException('La necesidad no pertenece a este llamado');
    }

    // Un compromiso activo por (llamado, necesidad, iglesia): repetir el "¡Yo te ayudo!"
    // actualiza la cantidad/mensaje en vez de duplicar.
    const existente = await this.prisma.compromisoApoyo.findFirst({
      where: { llamadoId, iglesiaId, necesidadId: dto.necesidadId ?? null, estado: EstadoCompromiso.ACTIVO },
      select: { id: true },
    });
    if (existente) {
      await this.prisma.compromisoApoyo.update({
        where: { id: existente.id },
        data: { cantidad: dto.cantidad ?? null, mensaje: dto.mensaje ?? null },
      });
    } else {
      await this.prisma.compromisoApoyo.create({
        data: {
          llamadoId,
          iglesiaId,
          creadoPorId: usuarioId,
          necesidadId: dto.necesidadId ?? null,
          cantidad: dto.cantidad,
          mensaje: dto.mensaje,
        },
      });
    }

    const [yo] = await Promise.all([this.miUbicacion(iglesiaId)]);
    const necesidad = llamado.necesidades.find((n) => n.id === dto.necesidadId);
    const detalle = necesidad
      ? `${dto.cantidad ? `${dto.cantidad} ${necesidad.unidad ?? ''} — ` : ''}${necesidad.descripcion}`.trim()
      : 'el llamado en general';
    if (!existente) {
      void this.avisos.avisarAIglesias([llamado.iglesiaId], {
        tipo: TipoNotificacion.COMPROMISO_NUEVO,
        titulo: `${yo.nombre} se sumó a tu llamado`,
        mensaje: `${yo.nombre} va a apoyar "${llamado.titulo}" con: ${detalle}.`,
        url: `/red/llamados/${llamado.id}`,
      });
    }

    await this.reevaluarCobertura(llamadoId);
    this.realtimeService.emitAIglesia(llamado.iglesiaId, REALTIME_EVENTS.LLAMADO_ACTUALIZADO, { llamadoId });
    return this.getLlamado(iglesiaId, llamadoId);
  }

  async cancelarCompromiso(iglesiaId: string, compromisoId: string) {
    const compromiso = await this.prisma.compromisoApoyo.findFirst({
      where: { id: compromisoId, iglesiaId },
      select: { id: true, estado: true, llamadoId: true },
    });
    if (!compromiso) {
      throw new NotFoundException('Compromiso no encontrado');
    }
    if (compromiso.estado === EstadoCompromiso.CANCELADO) {
      return { ok: true };
    }

    await this.prisma.compromisoApoyo.update({
      where: { id: compromisoId },
      data: { estado: EstadoCompromiso.CANCELADO },
    });

    const llamado = await this.prisma.llamadoAyuda.findUnique({
      where: { id: compromiso.llamadoId },
      select: { id: true, iglesiaId: true, titulo: true },
    });
    if (llamado) {
      const yo = await this.miUbicacion(iglesiaId);
      void this.avisos.avisarAIglesias(
        [llamado.iglesiaId],
        {
          tipo: TipoNotificacion.COMPROMISO_CANCELADO,
          titulo: `${yo.nombre} canceló su apoyo`,
          mensaje: `${yo.nombre} ya no podrá apoyar "${llamado.titulo}".`,
          url: `/red/llamados/${llamado.id}`,
        },
        false,
      );
      await this.reevaluarCobertura(llamado.id);
      this.realtimeService.emitAIglesia(llamado.iglesiaId, REALTIME_EVENTS.LLAMADO_ACTUALIZADO, {
        llamadoId: llamado.id,
      });
    }
    return { ok: true };
  }

  async misCompromisos(iglesiaId: string) {
    const compromisos = await this.prisma.compromisoApoyo.findMany({
      where: { iglesiaId, estado: EstadoCompromiso.ACTIVO },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cantidad: true,
        mensaje: true,
        createdAt: true,
        necesidad: { select: { id: true, descripcion: true, unidad: true } },
        llamado: {
          select: {
            id: true,
            titulo: true,
            estado: true,
            comuna: true,
            region: true,
            fechaInicio: true,
            iglesiaId: true,
          },
        },
      },
    });
    const perfiles = await this.perfilesDe(compromisos.map((c) => c.llamado.iglesiaId));
    return compromisos.map(({ llamado, ...c }) => {
      const { iglesiaId: duenaId, ...datosLlamado } = llamado;
      return { ...c, llamado: { ...datosLlamado, iglesia: perfiles.get(duenaId) ?? null } };
    });
  }

  async reportar(iglesiaId: string, llamadoId: string, motivo: string) {
    const llamado = await this.llamadoVisibleOrThrow(llamadoId);
    if (llamado.iglesiaId === iglesiaId) {
      throw new BadRequestException('No puedes reportar un llamado propio');
    }
    try {
      await this.prisma.reporteRed.create({ data: { llamadoId, iglesiaId, motivo } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya reportaste este llamado');
      }
      throw error;
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  /**
   * ABIERTO → CUBIERTO cuando todas las necesidades con meta llegaron a su meta, y
   * CUBIERTO → ABIERTO si un apoyo cancelado la deja corta. Escribe sobre el llamado de
   * OTRA iglesia (la dueña), por eso bajo runAsService: la acción que lo dispara (un
   * compromiso propio) ya pasó por RLS.
   */
  private async reevaluarCobertura(llamadoId: string): Promise<void> {
    const cambio = await runAsService(async () => {
      const llamado = await this.prisma.llamadoAyuda.findUnique({
        where: { id: llamadoId },
        include: LLAMADO_INCLUDE,
      });
      if (!llamado || llamado.estado === EstadoLlamado.CERRADO) {
        return null;
      }
      const completa = coberturaCompleta(llamado.necesidades, llamado.compromisos);
      if (completa === null) {
        return null;
      }
      const nuevo = completa ? EstadoLlamado.CUBIERTO : EstadoLlamado.ABIERTO;
      if (nuevo === llamado.estado) {
        return null;
      }
      await this.prisma.llamadoAyuda.update({ where: { id: llamadoId }, data: { estado: nuevo } });
      return { nuevo, llamado };
    });

    if (cambio?.nuevo === EstadoLlamado.CUBIERTO) {
      void this.avisos.avisarAIglesias([cambio.llamado.iglesiaId], {
        tipo: TipoNotificacion.LLAMADO_CUBIERTO,
        titulo: '¡Tu llamado quedó cubierto!',
        mensaje: `Todas las necesidades de "${cambio.llamado.titulo}" ya tienen el apoyo que pediste.`,
        url: `/red/llamados/${llamadoId}`,
      });
    }
  }

  /** Avisa a las iglesias a las que les corresponde ver el llamado (no a la que lo publicó). */
  private async avisarLlamadoNuevo(llamado: LlamadoConDetalle, nombreIglesia: string): Promise<void> {
    const destinatarios = await runAsService(async () => {
      if (llamado.visibilidad === VisibilidadLlamado.ALIADAS) {
        const alianzas = await this.prisma.alianza.findMany({
          where: {
            estado: EstadoAlianza.ACEPTADA,
            OR: [{ solicitanteId: llamado.iglesiaId }, { receptoraId: llamado.iglesiaId }],
          },
          select: { solicitanteId: true, receptoraId: true },
        });
        return alianzas.map((a) => (a.solicitanteId === llamado.iglesiaId ? a.receptoraId : a.solicitanteId));
      }

      // NACIONAL notifica solo a la región (avisar a todo el país sería ruido); el feed sí
      // lo muestra en todas partes.
      const iglesias = await this.prisma.iglesia.findMany({
        where: {
          id: { not: llamado.iglesiaId },
          estado: 'ACTIVA',
          region: llamado.region,
          ...(llamado.visibilidad === VisibilidadLlamado.COMUNA ? { comuna: llamado.comuna } : {}),
        },
        select: { id: true },
      });
      return iglesias.map((i) => i.id);
    });

    await this.avisos.avisarAIglesias(destinatarios, {
      tipo: TipoNotificacion.LLAMADO_NUEVO,
      titulo: `Nuevo llamado de ayuda en ${llamado.comuna}`,
      mensaje: `${nombreIglesia} necesita apoyo: "${llamado.titulo}".`,
      url: `/red/llamados/${llamado.id}`,
    });
  }

  private async verificarCupoLlamados(iglesiaId: string, plan: keyof typeof PLAN_LIMITS): Promise<void> {
    const maximo = PLAN_LIMITS[plan].maxLlamadosAbiertos;
    const abiertos = await this.prisma.llamadoAyuda.count({
      where: { iglesiaId, estado: { in: ESTADOS_ACTIVOS } },
    });
    if (abiertos >= maximo) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LIMITE_PLAN',
        message: `El plan ${PLAN_LABEL[plan]} permite ${maximo} llamado(s) abierto(s) a la vez. Cierra uno o mejora tu plan.`,
        limite: maximo,
      });
    }
  }

  private validarFechas(inicio?: string, fin?: string): void {
    if (inicio && fin && new Date(fin) < new Date(inicio)) {
      throw new BadRequestException('La fecha de término no puede ser anterior a la de inicio');
    }
  }

  private async miUbicacion(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: { nombre: true, region: true, comuna: true, plan: true },
    });
    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }
    return iglesia;
  }

  /** RLS devuelve null si el llamado es de otra iglesia y no te corresponde verlo. */
  private async llamadoVisibleOrThrow(id: string): Promise<LlamadoConDetalle> {
    const llamado = await this.prisma.llamadoAyuda.findUnique({ where: { id }, include: LLAMADO_INCLUDE });
    if (!llamado) {
      throw new NotFoundException('Llamado no encontrado');
    }
    return llamado;
  }

  private async llamadoPropioOrThrow(iglesiaId: string, id: string) {
    const llamado = await this.prisma.llamadoAyuda.findFirst({ where: { id, iglesiaId } });
    if (!llamado) {
      throw new NotFoundException('Llamado no encontrado');
    }
    return llamado;
  }

  private async perfilesDe(iglesiaIds: string[]): Promise<Map<string, PerfilPublico>> {
    const ids = [...new Set(iglesiaIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const perfiles = await this.prisma.perfilRed.findMany({
      where: { iglesiaId: { in: ids } },
      select: PERFIL_PUBLICO_SELECT,
    });
    return new Map(perfiles.map((p) => [p.iglesiaId, p]));
  }

  private async alianzasPropias(iglesiaId: string) {
    return this.prisma.alianza.findMany({
      where: { OR: [{ solicitanteId: iglesiaId }, { receptoraId: iglesiaId }] },
      select: { solicitanteId: true, receptoraId: true, estado: true },
    });
  }

  private estadoAlianzaCon(
    iglesiaId: string,
    otraId: string,
    alianzas: { solicitanteId: string; receptoraId: string; estado: EstadoAlianza }[],
  ): EstadoAlianzaVista {
    const alianza = alianzas.find(
      (a) =>
        (a.solicitanteId === iglesiaId && a.receptoraId === otraId) ||
        (a.receptoraId === iglesiaId && a.solicitanteId === otraId),
    );
    if (!alianza) return null;
    if (alianza.estado === EstadoAlianza.PENDIENTE) {
      return alianza.solicitanteId === iglesiaId ? 'PENDIENTE_ENVIADA' : 'PENDIENTE_RECIBIDA';
    }
    return alianza.estado;
  }

  private resumenLlamado(
    llamado: LlamadoConDetalle,
    iglesiaId: string,
    perfiles: Map<string, PerfilPublico>,
  ) {
    const { compromisos, necesidades, iglesiaId: duenaId, creadoPorId: _creadoPorId, ...datos } = llamado;
    return {
      ...datos,
      esPropio: duenaId === iglesiaId,
      iglesia: perfiles.get(duenaId) ?? null,
      necesidades: calcularProgreso(necesidades, compromisos),
      iglesiasApoyando: new Set(compromisos.map((c) => c.iglesiaId)).size,
      yoApoyo: compromisos.some((c) => c.iglesiaId === iglesiaId),
    };
  }

  private detalleLlamado(
    llamado: LlamadoConDetalle,
    iglesiaId: string,
    perfiles: Map<string, PerfilPublico>,
  ) {
    return {
      ...this.resumenLlamado(llamado, iglesiaId, perfiles),
      compromisos: llamado.compromisos.map((c) => ({
        ...c,
        esPropio: c.iglesiaId === iglesiaId,
        iglesia: perfiles.get(c.iglesiaId) ?? null,
      })),
    };
  }
}
