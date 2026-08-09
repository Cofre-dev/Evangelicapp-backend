import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/**
 * Storage de Supabase para logos/fotos. Los 3 buckets (`logos-iglesias`,
 * `fotos-perfil`, `fotos-integrantes`) son públicos de lectura — por eso el
 * valor que se persiste en `logoUrl`/`fotoUrl` es directamente la URL pública,
 * sin necesidad de generar URLs firmadas en cada lectura.
 *
 * Usa la service_role key: el backend es el único que escribe (multer ya validó
 * mimetype/tamaño antes de llegar acá), no hay Supabase Auth todavía (Fase 7 del
 * plan) así que no existe un JWT de usuario contra el que aplicar RLS.
 */
@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );
  }

  /** Sube un archivo y devuelve su URL pública. */
  async upload(bucket: string, objectName: string, file: Express.Multer.File): Promise<string> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(objectName, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) {
      throw new InternalServerErrorException(
        `No se pudo subir el archivo a Supabase Storage: ${error.message}`,
      );
    }

    return this.client.storage.from(bucket).getPublicUrl(objectName).data.publicUrl;
  }

  /**
   * Borra un objeto a partir de su URL pública. Best-effort (mismo criterio que el
   * `unlink(...).catch(() => undefined)` a disco que reemplaza): si falla, solo
   * queda un objeto huérfano en el bucket, no debe tumbar la operación principal.
   */
  async removeByPublicUrl(publicUrl: string): Promise<void> {
    const parsed = this.parsePublicUrl(publicUrl);
    if (!parsed) return;

    const { error } = await this.client.storage.from(parsed.bucket).remove([parsed.objectName]);
    if (error) {
      this.logger.warn(`No se pudo borrar ${publicUrl} de Supabase Storage: ${error.message}`);
    }
  }

  private parsePublicUrl(url: string): { bucket: string; objectName: string } | null {
    const match = PUBLIC_URL_PATTERN.exec(url);
    if (!match) return null;
    return { bucket: match[1], objectName: decodeURIComponent(match[2]) };
  }
}
