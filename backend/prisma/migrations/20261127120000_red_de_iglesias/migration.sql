-- Red de iglesias + plan GRATUITO (ver docs/red-de-iglesias.md). Cambios:
--   * PlanIglesia gana el valor GRATUITO; iglesias gana planPrevioMora, origen,
--     verificada, verificadaEn, y proximaFacturacion pasa a ser opcional.
--   * usuarios gana notificacionesRedEmail.
--   * Tablas nuevas: perfiles_red, llamados_ayuda, necesidades_llamado,
--     compromisos_apoyo, alianzas, notificaciones, reportes_red,
--     solicitudes_registro_iglesia.
--   * Backfill: las iglesias existentes (todas dadas de alta por el SuperAdmin, con plan
--     de pago) quedan verificadas, y cada una recibe su perfil de red OCULTO (visible =
--     false: la red es opt-in para quien no se registró por ella).
--   * RLS en todas las tablas nuevas. Ninguna policy existente se modifica.
--
-- SQL del esquema generado con `prisma migrate diff`; backfill y RLS escritos a mano.
-- Aplicar igual que las anteriores (README, "Migraciones de base de datos").

-- CreateEnum
CREATE TYPE "OrigenIglesia" AS ENUM ('SUPER_ADMIN', 'AUTOSERVICIO');

-- CreateEnum
CREATE TYPE "TipoLlamado" AS ENUM ('OPERATIVO_SOCIAL', 'VOLUNTARIADO', 'RECOLECCION', 'EVENTO_CONJUNTO', 'OTRO');

-- CreateEnum
CREATE TYPE "VisibilidadLlamado" AS ENUM ('COMUNA', 'REGION', 'NACIONAL', 'ALIADAS');

-- CreateEnum
CREATE TYPE "EstadoLlamado" AS ENUM ('ABIERTO', 'CUBIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoNecesidad" AS ENUM ('VOLUNTARIOS', 'INSUMOS', 'SERVICIO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCompromiso" AS ENUM ('ACTIVO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoAlianza" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('LLAMADO_NUEVO', 'COMPROMISO_NUEVO', 'COMPROMISO_CANCELADO', 'LLAMADO_CUBIERTO', 'ALIANZA_SOLICITADA', 'ALIANZA_ACEPTADA', 'IGLESIA_VERIFICADA', 'PLAN_DEGRADADO');

-- AlterEnum
ALTER TYPE "PlanIglesia" ADD VALUE 'GRATUITO';

-- AlterTable
ALTER TABLE "iglesias" ADD COLUMN     "origen" "OrigenIglesia" NOT NULL DEFAULT 'SUPER_ADMIN',
ADD COLUMN     "planPrevioMora" "PlanIglesia",
ADD COLUMN     "verificada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificadaEn" TIMESTAMP(3),
ALTER COLUMN "proximaFacturacion" DROP NOT NULL;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "notificacionesRedEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "perfiles_red" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "logoUrl" TEXT,
    "verificada" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "emailContacto" TEXT,
    "telefonoContacto" TEXT,
    "sitioWeb" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,

    CONSTRAINT "perfiles_red_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llamados_ayuda" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoLlamado" NOT NULL,
    "visibilidad" "VisibilidadLlamado" NOT NULL,
    "estado" "EstadoLlamado" NOT NULL DEFAULT 'ABIERTO',
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "direccion" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "ocultoModeracion" BOOLEAN NOT NULL DEFAULT false,
    "cerradoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "llamados_ayuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "necesidades_llamado" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoNecesidad" NOT NULL,
    "cantidadMeta" INTEGER,
    "unidad" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "llamadoId" TEXT NOT NULL,

    CONSTRAINT "necesidades_llamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compromisos_apoyo" (
    "id" TEXT NOT NULL,
    "cantidad" INTEGER,
    "mensaje" TEXT,
    "estado" "EstadoCompromiso" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "llamadoId" TEXT NOT NULL,
    "necesidadId" TEXT,
    "iglesiaId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "compromisos_apoyo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alianzas" (
    "id" TEXT NOT NULL,
    "estado" "EstadoAlianza" NOT NULL DEFAULT 'PENDIENTE',
    "mensaje" TEXT,
    "respondidaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "receptoraId" TEXT NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "alianzas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "url" TEXT,
    "leidaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_red" (
    "id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "revisadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "llamadoId" TEXT NOT NULL,
    "iglesiaId" TEXT NOT NULL,

    CONSTRAINT "reportes_red_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_registro_iglesia" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_registro_iglesia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_red_iglesiaId_key" ON "perfiles_red"("iglesiaId");

-- CreateIndex
CREATE INDEX "perfiles_red_region_comuna_idx" ON "perfiles_red"("region", "comuna");

-- CreateIndex
CREATE INDEX "llamados_ayuda_estado_region_comuna_idx" ON "llamados_ayuda"("estado", "region", "comuna");

-- CreateIndex
CREATE INDEX "llamados_ayuda_iglesiaId_createdAt_idx" ON "llamados_ayuda"("iglesiaId", "createdAt");

-- CreateIndex
CREATE INDEX "necesidades_llamado_llamadoId_idx" ON "necesidades_llamado"("llamadoId");

-- CreateIndex
CREATE INDEX "compromisos_apoyo_llamadoId_idx" ON "compromisos_apoyo"("llamadoId");

-- CreateIndex
CREATE INDEX "compromisos_apoyo_iglesiaId_idx" ON "compromisos_apoyo"("iglesiaId");

-- CreateIndex
CREATE INDEX "alianzas_receptoraId_estado_idx" ON "alianzas"("receptoraId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "alianzas_solicitanteId_receptoraId_key" ON "alianzas"("solicitanteId", "receptoraId");

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_leidaEn_createdAt_idx" ON "notificaciones"("usuarioId", "leidaEn", "createdAt");

-- CreateIndex
CREATE INDEX "notificaciones_iglesiaId_idx" ON "notificaciones"("iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "reportes_red_llamadoId_iglesiaId_key" ON "reportes_red"("llamadoId", "iglesiaId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_registro_iglesia_tokenHash_key" ON "solicitudes_registro_iglesia"("tokenHash");

-- CreateIndex
CREATE INDEX "solicitudes_registro_iglesia_email_idx" ON "solicitudes_registro_iglesia"("email");

-- AddForeignKey
ALTER TABLE "perfiles_red" ADD CONSTRAINT "perfiles_red_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llamados_ayuda" ADD CONSTRAINT "llamados_ayuda_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llamados_ayuda" ADD CONSTRAINT "llamados_ayuda_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "necesidades_llamado" ADD CONSTRAINT "necesidades_llamado_llamadoId_fkey" FOREIGN KEY ("llamadoId") REFERENCES "llamados_ayuda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisos_apoyo" ADD CONSTRAINT "compromisos_apoyo_llamadoId_fkey" FOREIGN KEY ("llamadoId") REFERENCES "llamados_ayuda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisos_apoyo" ADD CONSTRAINT "compromisos_apoyo_necesidadId_fkey" FOREIGN KEY ("necesidadId") REFERENCES "necesidades_llamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisos_apoyo" ADD CONSTRAINT "compromisos_apoyo_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compromisos_apoyo" ADD CONSTRAINT "compromisos_apoyo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alianzas" ADD CONSTRAINT "alianzas_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alianzas" ADD CONSTRAINT "alianzas_receptoraId_fkey" FOREIGN KEY ("receptoraId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alianzas" ADD CONSTRAINT "alianzas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_red" ADD CONSTRAINT "reportes_red_llamadoId_fkey" FOREIGN KEY ("llamadoId") REFERENCES "llamados_ayuda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_red" ADD CONSTRAINT "reportes_red_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ==========================================================================
-- Backfill
-- ==========================================================================

UPDATE "iglesias" SET "verificada" = true, "verificadaEn" = CURRENT_TIMESTAMP;

INSERT INTO "perfiles_red" ("id", "nombre", "comuna", "region", "logoUrl", "verificada", "visible", "createdAt", "updatedAt", "iglesiaId")
SELECT 'pr_' || "id", "nombre", "comuna", "region", "logoUrl", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "iglesias";

-- ==========================================================================
-- RLS (Fase 8 de docs/supabase.md). app_iglesia_id() / app_is_privileged() ya existen
-- (20260820181542_enable_rls_tenant_isolation). Política general de la red: cualquier
-- iglesia autenticada (app_iglesia_id() no nulo) puede LEER lo que la red publica; solo
-- la iglesia dueña puede ESCRIBIR lo suyo. Un request sin contexto de tenant no ve nada.
-- Los avisos a OTRAS iglesias (notificaciones) se crean bajo runAsService.
-- ==========================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      "perfiles_red", "llamados_ayuda", "necesidades_llamado", "compromisos_apoyo",
      "alianzas", "notificaciones", "reportes_red", "solicitudes_registro_iglesia"
    TO app_runtime;
  END IF;
END $$;

-- perfiles_red: lectura para toda iglesia autenticada; escritura solo la dueña. `visible`
-- solo decide si aparece en el LISTADO del directorio (filtro de la app): el perfil de
-- una iglesia que publica un llamado, apoya uno o pide una alianza tiene que poder
-- mostrarse (nombre, comuna, logo). El perfil contiene solo datos pensados para ser
-- públicos; los de contacto los completa la propia iglesia, opcionales.
ALTER TABLE "perfiles_red" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "perfiles_red" FORCE ROW LEVEL SECURITY;
CREATE POLICY red_lectura ON "perfiles_red" FOR SELECT
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged())
         OR (SELECT app_iglesia_id()) IS NOT NULL);
CREATE POLICY red_escritura ON "perfiles_red" FOR ALL
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));

-- alianzas: solo las dos iglesias involucradas.
ALTER TABLE "alianzas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alianzas" FORCE ROW LEVEL SECURITY;
CREATE POLICY red_partes ON "alianzas" FOR ALL
  USING ("solicitanteId" = (SELECT app_iglesia_id()) OR "receptoraId" = (SELECT app_iglesia_id())
         OR (SELECT app_is_privileged()))
  WITH CHECK ("solicitanteId" = (SELECT app_iglesia_id()) OR "receptoraId" = (SELECT app_iglesia_id())
              OR (SELECT app_is_privileged()));

-- llamados_ayuda: la dueña ve todo lo suyo; las demás ven lo no ocultado por moderación,
-- y los de visibilidad ALIADAS solo si hay una alianza ACEPTADA entre ambas (la
-- subconsulta a alianzas pasa a su vez por la policy de alianzas).
ALTER TABLE "llamados_ayuda" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "llamados_ayuda" FORCE ROW LEVEL SECURITY;
CREATE POLICY red_lectura ON "llamados_ayuda" FOR SELECT
  USING (
    "iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged())
    OR (
      (SELECT app_iglesia_id()) IS NOT NULL
      AND NOT "ocultoModeracion"
      AND (
        "visibilidad" <> 'ALIADAS'
        OR EXISTS (
          SELECT 1 FROM "alianzas" a
          WHERE a."estado" = 'ACEPTADA'
            AND ((a."solicitanteId" = "llamados_ayuda"."iglesiaId" AND a."receptoraId" = (SELECT app_iglesia_id()))
              OR (a."receptoraId" = "llamados_ayuda"."iglesiaId" AND a."solicitanteId" = (SELECT app_iglesia_id())))
        )
      )
    )
  );
CREATE POLICY red_escritura ON "llamados_ayuda" FOR ALL
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));

-- necesidades_llamado: se leen si se puede leer el llamado; se escriben si el llamado es propio.
ALTER TABLE "necesidades_llamado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "necesidades_llamado" FORCE ROW LEVEL SECURITY;
CREATE POLICY red_lectura ON "necesidades_llamado" FOR SELECT
  USING ((SELECT app_is_privileged())
         OR EXISTS (SELECT 1 FROM "llamados_ayuda" l WHERE l."id" = "necesidades_llamado"."llamadoId"));
CREATE POLICY red_escritura ON "necesidades_llamado" FOR ALL
  USING ((SELECT app_is_privileged())
         OR EXISTS (SELECT 1 FROM "llamados_ayuda" l
                    WHERE l."id" = "necesidades_llamado"."llamadoId" AND l."iglesiaId" = (SELECT app_iglesia_id())))
  WITH CHECK ((SELECT app_is_privileged())
              OR EXISTS (SELECT 1 FROM "llamados_ayuda" l
                         WHERE l."id" = "necesidades_llamado"."llamadoId" AND l."iglesiaId" = (SELECT app_iglesia_id())));

-- compromisos_apoyo: los ve toda iglesia que pueda ver el llamado; los escribe solo la
-- iglesia que ayuda.
ALTER TABLE "compromisos_apoyo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compromisos_apoyo" FORCE ROW LEVEL SECURITY;
CREATE POLICY red_lectura ON "compromisos_apoyo" FOR SELECT
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged())
         OR EXISTS (SELECT 1 FROM "llamados_ayuda" l WHERE l."id" = "compromisos_apoyo"."llamadoId"));
CREATE POLICY red_escritura ON "compromisos_apoyo" FOR ALL
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));

-- notificaciones y reportes_red: estándar por iglesia.
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notificaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notificaciones"
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));

ALTER TABLE "reportes_red" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reportes_red" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reportes_red"
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));

-- solicitudes_registro_iglesia: solo el backend, bajo runAsService (rutas públicas).
ALTER TABLE "solicitudes_registro_iglesia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitudes_registro_iglesia" FORCE ROW LEVEL SECURITY;
CREATE POLICY service_only ON "solicitudes_registro_iglesia"
  USING ((SELECT app_is_privileged()))
  WITH CHECK ((SELECT app_is_privileged()));
