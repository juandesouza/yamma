export type UserRole = 'customer' | 'restaurant' | 'admin' | 'driver';

export interface AuthUser {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
}
