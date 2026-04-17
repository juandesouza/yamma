export type Role = 'customer' | 'restaurant' | 'admin' | 'driver';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  fiatBalance?: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface SessionUser extends User {
  sessionId: string;
}
