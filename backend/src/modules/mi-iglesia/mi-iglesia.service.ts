import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoLlamado, Rol } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PLAN_LIMITS } from '../../common/constants/plan';
import { resolverComuna } from '../../common/constants/chile-regiones';
import { estadoFacturacionDe } from '../../common/utils/calcular-facturacion';
import { sincronizarPerfilRed } from '../red/perfil-red.sync';
import { LOGO_RESIZE, resolverExtensionLogo } from '../iglesias/logo-upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../../supabase/supabase-storage.service';
import { UpdateMiIglesiaDto } from './dto/update-mi-iglesia.dto';

const MI_IGLESIA_SELECT = {
  id: true,
  nombre: true,
  comuna: true,
  region: true,
  direccion: true,
  logoUrl: true,
  estado: true,
  plan: true,
  verificada: true,
  visitantesPromedio: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Además de MI_IGLESIA_SELECT: los campos de plan/facturación, solo relevantes para el módulo de facturación. */
const MI_IGLESIA_FACTURACION_SELECT = {
  ...MI_IGLESIA_SELECT,
  planPrevioMora: true,
  proximaFacturacion: true,
  ultimoPagoAt: true,
} as const;

@Injectable()
export class MiIglesiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  async findOne(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: MI_IGLESIA_SELECT,
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    return iglesia;
  }

  /**
   * Módulo de facturación (solo informativo, sin pasarela de pago todavía — ver
   * CLAUDE.md): plan contratado, semáforo de la próxima facturación y uso actual
   * contra los topes del plan, para que el manager sepa cuánto le queda de cupo.
   */
  async findFacturacion(iglesiaId: string) {
    const iglesia = await this.prisma.iglesia.findUnique({
      where: { id: iglesiaId },
      select: MI_IGLESIA_FACTURACION_SELECT,
    });

    if (!iglesia) {
      throw new NotFoundException('Iglesia no encontrada');
    }

    const { plan, proximaFacturacion, ...iglesiaData } = iglesia;

    const [usuariosActuales, departamentosActuales, llamadosAbiertos] = await Promise.all([
      this.prisma.usuario.count({
        where: { iglesiaId, activo: true, rol: { in: [Rol.MANAGER, Rol.USUARIO] } },
      }),
      this.prisma.departamentoFinanciero.count({ where: { iglesiaId, activo: true } }),
      this.prisma.llamadoAyuda.count({
        where: { iglesiaId, estado: { in: [EstadoLlamado.ABIERTO, EstadoLlamado.CUBIERTO] } },
      }),
    ]);

    const limitesPlan = PLAN_LIMITS[plan];

    return {
      ...iglesiaData,
      plan,
      // null en plan GRATUITO: no paga, no hay semáforo. Si `planPrevioMora` viene con
      // valor, está en gratuito por mora y ese es el plan que recupera al pagar.
      facturacion: estadoFacturacionDe(plan, proximaFacturacion),
      limites: {
        usuarios: { actuales: usuariosActuales, maximo: limitesPlan.maxUsuarios },
        departamentosFinancieros: {
          actuales: departamentosActuales,
          maximo: limitesPlan.maxDepartamentosFinancieros,
        },
        llamadosAbiertos: { actuales: llamadosAbiertos, maximo: limitesPlan.maxLlamadosAbiertos },
      },
    };
  }

  /** Corrige datos ingresados mal en el alta (nombre, comuna, región, dirección). */
  async update(iglesiaId: string, dto: UpdateMiIglesiaDto) {
    const actual = await this.findOne(iglesiaId);

    // La red hace match por comuna exacta: si se cambia región o comuna, el par tiene que
    // existir en el catálogo (ver chile-regiones.ts) y se guarda con el nombre canónico.
    let ubicacion: { region: string; comuna: string } | undefined;
    if (dto.region !== undefined || dto.comuna !== undefined) {
      const resuelta = resolverComuna(dto.region ?? actual.region, dto.comuna ?? actual.comuna);
      if (!resuelta) {
        throw new BadRequestException('La comuna no existe o no pertenece a la región indicada');
      }
      ubicacion = resuelta;
    }

    return this.prisma.withTenantTransaction(async (tx) => {
      const iglesia = await tx.iglesia.update({
        where: { id: iglesiaId },
        data: {
          nombre: dto.nombre,
          comuna: ubicacion?.comuna,
          region: ubicacion?.region,
          direccion: dto.direccion,
        },
        select: MI_IGLESIA_SELECT,
      });
      await sincronizarPerfilRed(tx, iglesiaId);
      return iglesia;
    });
  }

  /**
   * Reemplaza el logo, borrando el objeto anterior del bucket si existía. Sube el
   * nuevo antes de borrar el viejo: si la subida falla, la iglesia no se queda sin logo.
   */
  async updateLogo(iglesiaId: string, logo: Express.Multer.File) {
    const iglesia = await this.findOne(iglesiaId);

    const logoUrl = await this.supabaseStorage.upload(
      'logos-iglesias',
      `${randomUUID()}${resolverExtensionLogo(logo.mimetype)}`,
      logo,
      LOGO_RESIZE,
    );

    if (iglesia.logoUrl) {
      await this.supabaseStorage.removeByPublicUrl(iglesia.logoUrl);
    }

    const actualizada = await this.prisma.iglesia.update({
      where: { id: iglesiaId },
      data: { logoUrl },
      select: MI_IGLESIA_SELECT,
    });
    await sincronizarPerfilRed(this.prisma, iglesiaId);
    return actualizada;
  }
}
