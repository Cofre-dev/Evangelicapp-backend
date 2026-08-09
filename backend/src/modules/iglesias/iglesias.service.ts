import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoIglesia, Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { PLAN_LIMITS } from '../../common/constants/plan';
import { calcularEstadoFacturacion, sumarUnMes } from '../../common/utils/calcular-facturacion';
import { generateTemporaryPassword } from '../../common/utils/generate-temporary-password';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { ActualizarFacturacionDto } from './dto/actualizar-facturacion.dto';
import { CambiarPlanDto } from './dto/cambiar-plan.dto';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { resolverExtensionLogo } from './logo-upload.config';

const DETALLE_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  plan: true,
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
  ) {}

  /**
   * Crea la iglesia y su manager (dueño del tenant) en una sola transacción —
   * una iglesia sin manager a cargo no tiene sentido en este modelo. La
   * contraseña temporal se devuelve una sola vez, igual que con el resto del equipo.
   * El logo se sube a Storage antes de abrir la transacción: es una llamada de red,
   * no debe mantener la transacción de Prisma abierta mientras espera.
   */
  async create(dto: CreateIglesiaDto, logo?: Express.Multer.File) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const logoUrl = logo
      ? await this.supabaseStorage.upload(
          'logos-iglesias',
          `${randomUUID()}${resolverExtensionLogo(logo.mimetype)}`,
          logo,
        )
      : undefined;

    try {
      const { iglesia, pastor } = await this.prisma.$transaction(async (tx) => {
        const iglesia = await tx.iglesia.create({
          data: {
            nombre: dto.nombre,
            comuna: dto.comuna,
            region: dto.region,
            direccion: dto.direccion,
            plan: dto.plan,
            proximaFacturacion: new Date(dto.proximaFacturacion),
            logoUrl,
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

        return { iglesia, pastor };
      });

      return { iglesia, pastor, temporaryPassword };
    } catch (error) {
      throw translateUniqueConstraintError(error);
    }
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

  /** Cambiar de plan nunca borra ni desactiva datos existentes — solo mueve los topes hacia delante. */
  async cambiarPlan(id: string, dto: CambiarPlanDto) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({ where: { id }, data: { plan: dto.plan } });

    return this.findOne(id);
  }

  /** Corrección manual de la fecha de facturación (no confundir con `marcarPagada`, que además la avanza). */
  async actualizarFacturacion(id: string, dto: ActualizarFacturacionDto) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({
      where: { id },
      data: { proximaFacturacion: new Date(dto.proximaFacturacion) },
    });

    return this.findOne(id);
  }

  /**
   * Confirmación manual de pago (no hay pasarela todavía): avanza la fecha de
   * facturación un mes exacto desde la fecha vencida (no desde "hoy") y reactiva
   * la iglesia si estaba oculta por mora.
   */
  async marcarPagada(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    await this.prisma.iglesia.update({
      where: { id },
      data: {
        proximaFacturacion: sumarUnMes(iglesia.proximaFacturacion),
        ultimoPagoAt: new Date(),
        estado: EstadoIglesia.ACTIVA,
      },
    });

    return this.findOne(id);
  }

  /**
   * Oculta la iglesia (bloquea login y sesiones activas de todo su equipo, ver
   * AuthService/JwtStrategy). Solo disponible con 3+ días de mora — reforzado acá
   * también, no solo en el frontend (ver DIAS_GRACIA_MORA).
   */
  async ocultar(id: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id },
      select: { proximaFacturacion: true },
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const { puedeOcultar } = calcularEstadoFacturacion(iglesia.proximaFacturacion);
    if (!puedeOcultar) {
      throw new ForbiddenException(
        'Solo se puede ocultar una iglesia con 3 o más días de mora en su facturación.',
      );
    }

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.SUSPENDIDA } });

    return this.findOne(id);
  }

  /** Reactivación manual — siempre disponible (ej. el SuperAdmin ocultó por error). */
  async mostrar(id: string) {
    await this.requireExists(id);

    await this.prisma.iglesia.update({ where: { id }, data: { estado: EstadoIglesia.ACTIVA } });

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

    const departamentosActuales = await this.prisma.departamentoFinanciero.count({
      where: { iglesiaId: iglesia.id, activo: true },
    });

    const usuariosActuales = usuarios.filter(
      (u) => u.activo && (u.rol === Rol.MANAGER || u.rol === Rol.USUARIO),
    ).length;

    const limitesPlan = PLAN_LIMITS[plan];

    return {
      ...iglesiaData,
      plan,
      pastor: usuarios.find((u) => u.rol === Rol.MANAGER) ?? null,
      equipo: usuarios.filter((u) => u.rol !== Rol.MANAGER),
      facturacion: calcularEstadoFacturacion(proximaFacturacion),
      limites: {
        usuarios: { actuales: usuariosActuales, maximo: limitesPlan.maxUsuarios },
        departamentosFinancieros: {
          actuales: departamentosActuales,
          maximo: limitesPlan.maxDepartamentosFinancieros,
        },
      },
    };
  }
}
