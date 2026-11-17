import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ScimTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    const expectedToken = process.env.SCIM_TOKEN || 'itsm-scim-dev-token';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token SCIM ausente.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (token !== expectedToken) {
      throw new UnauthorizedException('Token SCIM inválido.');
    }

    return true;
  }
}
