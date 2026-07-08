-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `username` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_username_key` ON `usuarios`(`username`);
