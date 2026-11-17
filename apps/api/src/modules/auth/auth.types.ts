export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  type: 'access' | 'refresh' | 'mfa_pending';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}
