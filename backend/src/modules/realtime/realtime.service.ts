import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { iglesiaRoom, SUPERADMIN_ROOM } from './realtime-rooms.util';

/**
 * Capa fina sobre el Server de socket.io para que las services de negocio
 * (IglesiasService, PredicadoresService, IntegrantesService) puedan emitir
 * eventos sin importar nada de @nestjs/websockets ni conocer el Gateway.
 * RealtimeGateway le inyecta la instancia real del server en `afterInit`.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  emitAIglesia(iglesiaId: string, evento: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`Emit "${evento}" ignorado: el gateway todavía no inicializa`);
      return;
    }
    const room = iglesiaRoom(iglesiaId);
    const size = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
    this.logger.warn(`QA-DEBUG emitAIglesia room="${room}" socketsEnRoom=${size} evento="${evento}"`);
    this.server.to(room).emit(evento, payload);
  }

  emitASuperAdmin(evento: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`Emit "${evento}" ignorado: el gateway todavía no inicializa`);
      return;
    }
    this.server.to(SUPERADMIN_ROOM).emit(evento, payload);
  }
}
