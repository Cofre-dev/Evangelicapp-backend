/**
 * Rooms de socket.io. El scoping por tenant vive acá y en
 * RealtimeGateway#handleConnection — nunca en el cliente: un socket solo puede
 * unirse a la room de SU PROPIA iglesia (o a `superadmin` si el rol lo es),
 * nunca a una elegida por el propio cliente.
 */
export const SUPERADMIN_ROOM = 'superadmin';

export function iglesiaRoom(iglesiaId: string): string {
  return `iglesia:${iglesiaId}`;
}

export const REALTIME_EVENTS = {
  IGLESIA_ACTUALIZADA: 'iglesia:actualizada',
  PREDICADOR_RESPONDIO: 'predicador:respondio',
  INTEGRANTE_REGISTRADO: 'integrante:registrado',
} as const;
