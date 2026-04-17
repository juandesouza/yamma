/**
 * Delivery integration – API contract for future driver app (Uber-like)
 */

export type DriverAssignmentStatus = 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export interface DriverLocationUpdate {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string; // ISO
}

export interface DriverAssignmentEvent {
  type: 'assigned' | 'accepted' | 'rejected' | 'picked_up' | 'arrived' | 'in_transit' | 'delivered' | 'cancelled';
  orderId: string;
  driverId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface DeliveryWebhookPayload {
  event: DriverAssignmentEvent['type'];
  orderId: string;
  driverId: string;
  timestamp: string;
  location?: { lat: number; lng: number };
  eta?: string; // ISO
}
