import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const COMPANY_ID_HEADER = 'x-company-id';

/**
 * Parámetro que inyecta el companyId extraído del header (ya validado por CompanyIdGuard).
 * Usar en rutas protegidas por CompanyIdGuard.
 */
export const CompanyId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ companyId?: string }>();
    return request.companyId as string;
  },
);
