import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage, type FileFilterCallback } from 'multer';
import { join } from 'path';

export const LOGOS_DIR = join(process.cwd(), 'uploads', 'logos');

if (!existsSync(LOGOS_DIR)) {
  mkdirSync(LOGOS_DIR, { recursive: true });
}

/**
 * Única fuente de verdad de mimetypes permitidos y su extensión de guardado.
 * La extensión del archivo en disco SIEMPRE sale de este mapeo (mimetype ya
 * validado por fileFilter), nunca de `file.originalname` — ese nombre lo
 * controla quien sube el archivo, y usarlo permitiría guardar un archivo con
 * contenido cualquiera bajo una extensión ejecutable/servible como `.html`.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Almacenamiento local en disco. Suficiente mientras no haya un bucket
 * (S3/Cloud Storage) configurado; el logoUrl guardado es solo la ruta
 * relativa, así que migrar el storage más adelante no toca el schema.
 */
export const logoMulterOptions = {
  storage: diskStorage({
    destination: LOGOS_DIR,
    filename: (_req, file, callback) => {
      const extension = MIME_EXTENSIONS[file.mimetype];
      if (!extension) {
        // No debería pasar: fileFilter ya rechazó cualquier mimetype fuera del mapeo.
        callback(new BadRequestException('El logo debe ser PNG, JPG o WEBP'), '');
        return;
      }
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  fileFilter: (_req, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      callback(new BadRequestException('El logo debe ser PNG, JPG o WEBP'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_LOGO_SIZE_BYTES },
};
