/*
  Warnings:

  - Made the column `descripcion` on table `movimientos_financieros` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `movimientos_financieros` ADD COLUMN `medioPago` ENUM('EFECTIVO', 'TRANSFERENCIA') NOT NULL DEFAULT 'EFECTIVO',
    MODIFY `descripcion` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `notas` ADD COLUMN `tipo` ENUM('RECORDATORIO', 'NOTA') NOT NULL DEFAULT 'RECORDATORIO',
    MODIFY `estado` ENUM('PENDIENTE', 'EN_REVISION', 'COMPLETADA') NOT NULL DEFAULT 'PENDIENTE';

-- CreateTable
CREATE TABLE `movimientos_auditoria` (
    `id` VARCHAR(191) NOT NULL,
    `accion` ENUM('CREACION', 'EDICION', 'ELIMINACION') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `iglesiaId` VARCHAR(191) NOT NULL,
    `movimientoId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NULL,
    `snapshot` JSON NOT NULL,

    INDEX `movimientos_auditoria_iglesiaId_createdAt_idx`(`iglesiaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `movimientos_auditoria` ADD CONSTRAINT `movimientos_auditoria_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_auditoria` ADD CONSTRAINT `movimientos_auditoria_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
