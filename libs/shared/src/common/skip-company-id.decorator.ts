import { SetMetadata } from '@nestjs/common';
import { SKIP_COMPANY_ID_KEY } from './company-id.guard';

/**
 * Marca la ruta para no exigir el header x-company-id (ej. /metrics).
 */
export const SkipCompanyId = () => SetMetadata(SKIP_COMPANY_ID_KEY, true);
