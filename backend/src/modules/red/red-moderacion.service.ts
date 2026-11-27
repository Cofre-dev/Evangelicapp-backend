import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Moderación de la red para el SuperAdmin (rol privilegiado en RLS: ve todo). Revisa los
 * reportes de llamados y puede ocultar un llamado a las demás iglesias.
 */
@Injectable()
export class RedModeracionService {
  constructor(private readonly prisma: PrismaService) {}

  async reportes(soloPendientes: boolean) {
    return this.prisma.reporteRed.findMany({
      where: soloPendientes ? { revisadoEn: null } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        motivo: true,
        createdAt: true,
        revisadoEn: true,
        iglesia: { select: { id: true, nombre: true } },
        llamado: {
          select: {
            id: true,
            titulo: true,
            descripcion: true,
            estado: true,
            ocultoModeracion: true,
            createdAt: true,
            iglesia: { select: { id: true, nombre: true, comuna: true, region: true } },
          },
        },
      },
    });
  }

  async moderarLlamado(llamadoId: string, oculto: boolean) {
    const { count } = await this.prisma.llamadoAyuda.updateMany({
      where: { id: llamadoId },
      data: { ocultoModeracion: oculto },
    });
    if (count === 0) {
      throw new NotFoundException('Llamado no encontrado');
    }
    // Decidir sobre el llamado resuelve todos sus reportes pendientes.
    await this.prisma.reporteRed.updateMany({
      where: { llamadoId, revisadoEn: null },
      data: { revisadoEn: new Date() },
    });
    return { ok: true, oculto };
  }

  async marcarRevisado(reporteId: string) {
    const { count } = await this.prisma.reporteRed.updateMany({
      where: { id: reporteId },
      data: { revisadoEn: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return { ok: true };
  }
}
