import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { EstadoIglesia, Rol } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../../common/constants/auth-cookies';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { resolveCorsOrigins } from '../../common/utils/cors-origins.util';
import { PrismaService } from '../../prisma/prisma.service';
import { iglesiaRoom, SUPERADMIN_ROOM } from './realtime-rooms.util';
import { RealtimeService } from './realtime.service';

/**
 * Un único gateway (no uno por pantalla) para las 3 pantallas de la Fase 5 de
 * docs/supabase.md: dashboard del SuperAdmin, evento del Pastor y censo en
 * vivo. Decisión propia, distinta a lo que planteaba el doc original
 * (Supabase Realtime nativo vía postgres_changes): ese mecanismo transmite a
 * cualquier cliente con la anon key pública salvo que RLS esté activo
 * filtrando fila por fila, y RLS (Fase 8) todavía no existe — depende de un
 * claim `iglesia_id` en el JWT de Supabase Auth (Fase 7), que tampoco existe.
 * Prender postgres_changes hoy habría expuesto eventos/integrantes de
 * cualquier iglesia a cualquier cliente. Este gateway en cambio reutiliza el
 * JWT propio que ya emite AuthService y hace el scoping por tenant del mismo
 * modo que cualquier query de Prisma: el servidor decide a qué room se une
 * cada socket (`iglesiaId` del payload verificado), nunca el cliente.
 */
@WebSocketGateway({
  cors: { origin: resolveCorsOrigins(), credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);
  }

  /**
   * Autenticación y join a la room correspondiente, una sola vez al conectar
   * (acá no hay mensajes entrantes del cliente, solo eventos salientes del
   * servidor). Mismo criterio mínimo que JwtStrategy.validate(): usuario
   * activo e iglesia no suspendida. A diferencia del HTTP (que revalida esto
   * en cada request), un socket que sigue abierto no se corta a mitad de
   * conexión si el usuario se desactiva o la iglesia entra en mora después de
   * conectar — limitación aceptada, acotada por la vida del propio socket
   * (el frontend reconecta con cookie fresca en cada carga de página).
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Sin token');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      const usuario = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { activo: true, iglesia: { select: { estado: true } } },
      });

      if (!usuario?.activo) {
        throw new Error('Usuario inactivo');
      }

      if (usuario.iglesia?.estado === EstadoIglesia.SUSPENDIDA) {
        throw new Error('Iglesia suspendida');
      }

      if (payload.rol === Rol.SUPER_ADMIN) {
        await client.join(SUPERADMIN_ROOM);
      } else if (payload.iglesiaId) {
        await client.join(iglesiaRoom(payload.iglesiaId));
      } else {
        throw new Error('Payload sin iglesiaId ni rol SUPER_ADMIN');
      }
    } catch (error) {
      this.logger.warn(`Conexión rechazada: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Nada que limpiar acá: socket.io ya saca al cliente de sus rooms al desconectar.
  }

  /**
   * Mismo criterio que cookieExtractor de JwtStrategy, pero sobre el header
   * crudo del handshake: cookie-parser solo engancha al servidor HTTP de
   * Express, no a la conexión de socket.io. `handshake.auth.token` queda
   * como alternativa para clientes que no puedan mandar la cookie httpOnly
   * cross-site (mismo espíritu que el fallback Bearer de JwtStrategy).
   */
  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token as string | undefined;
    if (fromAuth) {
      return fromAuth;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

    if (!match) {
      return null;
    }

    try {
      return decodeURIComponent(match.slice(ACCESS_TOKEN_COOKIE.length + 1));
    } catch {
      return null;
    }
  }
}
