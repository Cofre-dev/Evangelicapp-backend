import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage, type FileFilterCallback } from 'multer';
import { join } from 'path';

export const INTEGRANTES_DIR = join(process.cwd(), 'uploads', 'integrantes');

if (!existsSync(INTEGRANTES_DIR)) {
  mkdirSync(INTEGRANTES_DIR, { recursive: true });
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

const MAX_FOTO_SIZE_BYTES = 3 * 1024 * 1024;

/**
 * Almacenamiento local en disco, mismo criterio que `logo-upload.config.ts`.
 * Este endpoint es público (landing del QR), así que el límite de tamaño y
 * el fileFilter son la única barrera contra archivos maliciosos o abusivos.
 */
export const integranteFotoMulterOptions = {
  storage: diskStorage({
    destination: INTEGRANTES_DIR,
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
