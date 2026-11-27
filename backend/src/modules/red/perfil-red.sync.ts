import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Copia a `perfiles_red` los datos de `iglesias` que la red muestra (nombre, comuna,
 * región, logo, verificada). Las otras iglesias nunca leen `iglesias` (RLS), así que
 * cada punto que cambia esos datos llama a esta función:
 *   - IglesiasService#create / #cambiarPlan / #verificar (SuperAdmin)
 *   - MiIglesiaService#update / #updateLogo (MANAGER)
 *   - RedRegistroService#confirmar (registro autoservicio)
 *
 * Si la iglesia todavía no tiene perfil, lo crea con `visibleSiNoExiste` (las iglesias
 * dadas de alta por el SuperAdmin nacen fuera del listado del directorio; `visible` solo
 * controla ese listado — ver la policy de perfiles_red en la migración).
 * Es una función suelta (no un provider) para poder usarla dentro de una transacción
 * sin crear dependencias entre módulos.
 */
export async function sincronizarPerfilRed(
  db: Db,
  iglesiaId: string,
  visibleSiNoExiste = false,
): Promise<void> {
  const iglesia = await db.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { nombre: true, comuna: true, region: true, logoUrl: true, verificada: true },
  });
  if (!iglesia) {
    return;
  }

  await db.perfilRed.upsert({
    where: { iglesiaId },
    create: { iglesiaId, ...iglesia, visible: visibleSiNoExiste },
    update: iglesia,
  });
}
