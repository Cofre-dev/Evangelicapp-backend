-- CreateTable
CREATE TABLE `iglesias` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `comuna` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NULL,
    `estado` ENUM('ACTIVA', 'SUSPENDIDA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
    `visitantesPromedio` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `rol` ENUM('SUPER_ADMIN', 'PASTOR', 'TESORERO', 'SECRETARIA', 'MIEMBRO') NOT NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `onboardingCompletado` BOOLEAN NOT NULL DEFAULT false,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `iglesiaId` VARCHAR(191) NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_iglesiaId_idx`(`iglesiaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuarioId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `tipo` ENUM('CULTO', 'REUNION', 'LIMPIEZA', 'OTRO') NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `ubicacion` VARCHAR(191) NULL,
    `colorEtiqueta` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `iglesiaId` VARCHAR(191) NOT NULL,
    `creadoPorId` VARCHAR(191) NULL,

    INDEX `eventos_iglesiaId_fechaInicio_idx`(`iglesiaId`, `fechaInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `predicadores` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `tokenConfirmacion` VARCHAR(191) NOT NULL,
    `estado` ENUM('PENDIENTE', 'CONFIRMADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `respondidoAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `predicadores_tokenConfirmacion_key`(`tokenConfirmacion`),
    INDEX `predicadores_eventoId_idx`(`eventoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorias_financieras` (
    `id` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('INGRESO', 'EGRESO') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `iglesiaId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `categorias_financieras_iglesiaId_nombre_tipo_key`(`iglesiaId`, `nombre`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientos_financieros` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('INGRESO', 'EGRESO') NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `iglesiaId` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `creadoPorId` VARCHAR(191) NULL,

    INDEX `movimientos_financieros_iglesiaId_fecha_idx`(`iglesiaId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notas` (
    `id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `fechaLimite` DATETIME(3) NULL,
    `estado` ENUM('PENDIENTE', 'COMPLETADA') NOT NULL DEFAULT 'PENDIENTE',
    `notificado` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `iglesiaId` VARCHAR(191) NOT NULL,
    `creadoPorId` VARCHAR(191) NOT NULL,
    `asignadoAId` VARCHAR(191) NULL,

    INDEX `notas_iglesiaId_fechaLimite_idx`(`iglesiaId`, `fechaLimite`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos` ADD CONSTRAINT `eventos_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos` ADD CONSTRAINT `eventos_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `predicadores` ADD CONSTRAINT `predicadores_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `eventos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categorias_financieras` ADD CONSTRAINT `categorias_financieras_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_financieros` ADD CONSTRAINT `movimientos_financieros_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_financieros` ADD CONSTRAINT `movimientos_financieros_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `categorias_financieras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientos_financieros` ADD CONSTRAINT `movimientos_financieros_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_iglesiaId_fkey` FOREIGN KEY (`iglesiaId`) REFERENCES `iglesias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notas` ADD CONSTRAINT `notas_asignadoAId_fkey` FOREIGN KEY (`asignadoAId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
