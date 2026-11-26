-- Reporte financiero mensual a la congregación (ver ReporteCongregacionService y
-- docs/pendientes-producto.md). Solo agrega: 3 columnas en `iglesias`, 1 en
-- `categorias_financieras`, 3 en `integrantes` y la tabla nueva `envios_reporte_financiero`.
-- No modifica ni borra datos existentes (todo nace en false / null).
--
-- SQL generado con `prisma migrate diff` (schema anterior → schema nuevo) + el bloque de RLS
-- del final escrito a mano. Cómo se aplica: ver README "Migraciones de base de datos" — la
-- tabla nueva lleva RLS, así que probarla en un branch de Supabase de `Backend-staging`
-- antes de producción. Si se aplica por MCP, reconciliar después con
-- `prisma migrate resolve --applied 20261126120000_add_reporte_financiero_congregacion`.

-- CreateEnum
CREATE TYPE "OrigenEnvioReporte" AS ENUM ('AUTOMATICO', 'MANUAL');

-- AlterTable
ALTER TABLE "iglesias" ADD COLUMN     "reporteFinancieroActivadoEn" TIMESTAMP(3),
ADD COLUMN     "reporteFinancieroActivadoPorId" TEXT,
ADD COLUMN     "reporteFinancieroActivo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "categorias_financieras" ADD COLUMN     "ocultaEnReporte" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "integrantes" ADD COLUMN     "aceptaReporteFinanciero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aceptaReporteFinancieroEn" TIMESTAMP(3),
ADD COLUMN     "tokenBajaReporte" TEXT;

-- CreateTable
CREATE TABLE "envios_reporte_financiero" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "origen" "OrigenEnvioReporte" NOT NULL,
    "destinatarios" INTEGER NOT NULL,
    "enviados" INTEGER,
    "fallidos" INTEGER,
    "completadoEn" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iglesiaId" TEXT NOT NULL,
    "enviadoPorId" TEXT,

    CONSTRAINT "envios_reporte_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_reporte_financiero_iglesiaId_createdAt_idx" ON "envios_reporte_financiero"("iglesiaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "envios_reporte_financiero_iglesiaId_periodo_key" ON "envios_reporte_financiero"("iglesiaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "integrantes_tokenBajaReporte_key" ON "integrantes"("tokenBajaReporte");

-- AddForeignKey
ALTER TABLE "iglesias" ADD CONSTRAINT "iglesias_reporteFinancieroActivadoPorId_fkey" FOREIGN KEY ("reporteFinancieroActivadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_reporte_financiero" ADD CONSTRAINT "envios_reporte_financiero_iglesiaId_fkey" FOREIGN KEY ("iglesiaId") REFERENCES "iglesias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_reporte_financiero" ADD CONSTRAINT "envios_reporte_financiero_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ==========================================================================
-- Fase 8 de docs/supabase.md (RLS): misma policy estándar `tenant_isolation` que las
-- demás tablas con "iglesiaId" no nulo (ver 20260820181542_enable_rls_tenant_isolation).
-- El cron mensual y la baja pública por token corren bajo `runAsService` (bypass
-- privilegiado), igual que el cron de facturación. Las columnas nuevas de `iglesias`,
-- `categorias_financieras` e `integrantes` quedan cubiertas por las policies que esas
-- tablas ya tienen.
-- ==========================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "envios_reporte_financiero" TO app_runtime;
  END IF;
END $$;

ALTER TABLE "envios_reporte_financiero" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envios_reporte_financiero" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "envios_reporte_financiero"
  USING ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()))
  WITH CHECK ("iglesiaId" = (SELECT app_iglesia_id()) OR (SELECT app_is_privileged()));
