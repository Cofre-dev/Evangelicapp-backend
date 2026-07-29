import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage, type FileFilterCallback } from 'multer';
import { join } from 'path';

export const FOTOS_PERFIL_DIR = join(process.cwd(), 'uploads', 'perfiles');

if (!existsSync(FOTOS_PERFIL_DIR)) {
  mkdirSync(FOTOS_PERFIL_DIR, { recursive: true });
}

/**
 * Mismo criterio que logo-upload.config.ts: la extensión en disco sale siempre de este
 * mapeo (mimetype ya validado por fileFilter), nunca de `file.originalname`. A diferencia
 * del logo de iglesia, la foto de perfil personal no se usa en generación de certificados
 * (pdfkit), así que mantiene el whitelist amplio.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const MAX_FOTO_SIZE_BYTES = 2 * 1024 * 1024;

export const fotoPerfilMulterOptions = {
  storage: diskStorage({
    destination: FOTOS_PERFIL_DIR,
    filename: (_req, file, callback) => {
      const extension = MIME_EXTENSIONS[file.mimetype];
      if (!extension) {
        // No debería pasar: fileFilter ya rechazó cualquier mimetype fuera del mapeo.
        callback(new BadRequestException('La foto debe ser PNG, JPG o WEBP'), '');
        return;
      }
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  fileFilter: (_req, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      callback(new BadRequestException('La foto debe ser PNG, JPG o WEBP'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_FOTO_SIZE_BYTES },
};
