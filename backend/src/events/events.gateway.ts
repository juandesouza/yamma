import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

export const WS_EVENTS = {
  ORDER_STATUS: 'order:status',
  ORDER_COURIER_HANDOFF: 'order:courier_handoff',
  DRIVER_LOCATION: 'driver:location',
  RESTAURANT_ORDER: 'restaurant:order',
  ADMIN_ALERT: 'admin:alert',
} as const;

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private orderRooms = new Map<string, Set<string>>(); // orderId -> socketIds

  handleConnection(client: { id: string }) {
    // client can join rooms via subscribe
  }

  handleDisconnect(client: { id: string }) {
    this.orderRooms.forEach((set) => set.delete(client.id));
  }

  @SubscribeMessage('subscribe:order')
  handleSubscribeOrder(client: { id: string; join: (r: string) => void }, payload: { orderId: string }) {
    const room = `order:${payload.orderId}`;
    client.join(room);
    let set = this.orderRooms.get(payload.orderId);
    if (!set) {
      set = new Set();
      this.orderRooms.set(payload.orderId, set);
    }
    set.add(client.id);
  }

  @SubscribeMessage('subscribe:restaurant')
  handleSubscribeRestaurant(
    client: { join: (r: string) => void },
    payload: { restaurantId: string },
  ) {
    client.join(`restaurant:${payload.restaurantId}`);
  }

  emitOrderStatus(orderId: string, status: string, payload?: Record<string, unknown>) {
    this.server.to(`order:${orderId}`).emit(WS_EVENTS.ORDER_STATUS, { orderId, status, ...payload });
  }

  /** Buyer: restaurant sent the order to the external delivery partner (still `confirmed` until driver accepts). */
  emitOrderCourierHandoff(orderId: string) {
    this.server.to(`order:${orderId}`).emit(WS_EVENTS.ORDER_COURIER_HANDOFF, { orderId });
  }

  emitDriverLocation(orderId: string, lat: number, lng: number, eta?: string) {
    this.server.to(`order:${orderId}`).emit(WS_EVENTS.DRIVER_LOCATION, { orderId, lat, lng, eta });
  }

  emitRestaurantOrder(restaurantId: string, order: unknown) {
    this.server.to(`restaurant:${restaurantId}`).emit(WS_EVENTS.RESTAURANT_ORDER, order);
  }

  emitAdminAlert(message: string, payload?: Record<string, unknown>) {
    this.server.to('admin').emit(WS_EVENTS.ADMIN_ALERT, { message, ...payload });
  }
}
