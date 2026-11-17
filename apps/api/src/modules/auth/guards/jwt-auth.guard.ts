import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente.');
    }

    const token = authHeader.slice(7);
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
      });
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Tipo de token inválido.');
      }
      request.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
