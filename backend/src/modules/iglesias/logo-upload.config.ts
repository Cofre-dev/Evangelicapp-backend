import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage, type FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import type { Request } from 'express';

export const LOGOS_DIR = join(process.cwd(), 'uploads', 'logos');

if (!existsSync(LOGOS_DIR)) {
  mkdirSync(LOGOS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Almacenamiento local en disco. Suficiente mientras no haya un bucket
 * (S3/Cloud Storage) configurado; el logoUrl guardado es solo la ruta
 * relativa, así que migrar el storage más adelante no toca el schema.
 */
export const logoMulterOptions = {
  storage: diskStorage({
    destination: LOGOS_DIR,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestException('El logo debe ser PNG, JPG o WEBP'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
};
