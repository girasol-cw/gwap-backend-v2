import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COMPANY_ID_HEADER } from './company-id.decorator';

export const SKIP_COMPANY_ID_KEY = 'skipCompanyId';

/**
 * Guard que exige el header x-company-id y lo deja disponible en request.companyId.
 * Para rutas que no deben requerir tenant (ej. /metrics), usar @SetMetadata(SKIP_COMPANY_ID_KEY, true).
 */
@Injectable()
export class CompanyIdGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_ID_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { companyId?: string }>();
    const raw = request.headers[COMPANY_ID_HEADER];
    const companyId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;

    if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
      throw new BadRequestException(
        `Header "${COMPANY_ID_HEADER}" is required and must be a non-empty string`,
      );
    }

    request.companyId = companyId.trim();
    return true;
  }
}
