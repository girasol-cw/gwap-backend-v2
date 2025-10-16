// libs/shared/src/utils/lirium-error-mapper.ts
import { LiriumApiException, LiriumOperationForbiddenException, LiriumValidationException, LiriumInternalErrorException } from '../exceptions/lirium-api.exception';

export function mapLiriumError(error: any): LiriumApiException {
  if (error?.error?.error_code && error?.error?.error_msg) {
    const { error_code, error_msg, request_id } = error.error;
    const statusCode = error.status || 500;

    switch (error_code) {
      case 'operation_forbidden_for_customer':
        return new LiriumOperationForbiddenException(error_msg, request_id);
      
      case 'validation_error':
        return new LiriumValidationException(error_msg, request_id);
      
      case 'internal_error':
        return new LiriumInternalErrorException(error_msg, request_id);
      
      default:
        return new LiriumApiException(error_code, error_msg, request_id, statusCode);
    }
  }

  // Si no es un error de Lirium, crear un error genérico
  return new LiriumApiException(
    'unknown_error',
    error.message || 'Unknown error occurred',
    'unknown',
    500
  );
}