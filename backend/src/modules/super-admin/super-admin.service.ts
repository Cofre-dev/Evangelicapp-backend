import { Injectable } from '@nestjs/common';
import { EstadoIglesia, PlanIglesia, Rol } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardResponse {
  totales: {
    iglesias: number;
    iglesiasActivas: number;
    pastores: number;
  };
  porRegion: { region: string; cantidad: number }[];
  iglesias: {
    id: string;
    nombre: string;
    comuna: string;
    region: string;
    logoUrl: string | null;
    estado: EstadoIglesia;
    plan: PlanIglesia;
    createdAt: Date;
    pastor: { nombre: string; apellido: string; email: string } | null;
  }[];
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<DashboardResponse> {
    const [iglesiasTotal, iglesiasActivas, pastoresTotal, porRegionRaw, iglesias] = await Promise.all([
      this.prisma.iglesia.count(),
      this.prisma.iglesia.count({ where: { estado: EstadoIglesia.ACTIVA } }),
      this.prisma.usuario.count({ where: { rol: Rol.MANAGER } }),
      this.prisma.iglesia.groupBy({ by: ['region'], _count: { _all: true } }),
      this.prisma.iglesia.findMany({
        select: {
          id: true,
          nombre: true,
          comuna: true,
          region: true,
          logoUrl: true,
          estado: true,
          plan: true,
          createdAt: true,
          usuarios: {
            where: { rol: Rol.MANAGER },
            select: { nombre: true, apellido: true, email: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      totales: { iglesias: iglesiasTotal, iglesiasActivas, pastores: pastoresTotal },
      porRegion: porRegionRaw
        .map((r) => ({ region: r.region, cantidad: r._count._all }))
        .sort((a, b) => b.cantidad - a.cantidad),
      iglesias: iglesias.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        comuna: i.comuna,
        region: i.region,
        logoUrl: i.logoUrl,
        estado: i.estado,
        plan: i.plan,
        createdAt: i.createdAt,
        pastor: i.usuarios[0] ?? null,
      })),
    };
  }
}
