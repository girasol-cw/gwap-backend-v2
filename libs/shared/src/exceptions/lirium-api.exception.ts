import { HttpException } from "@nestjs/common";

export class LiriumApiException extends HttpException {
    constructor(
      public readonly errorCode: string,
      public readonly errorMessage: string,
      public readonly requestId: string,
      public readonly statusCode: number
    ) {
      super(
        {
          error_code: errorCode,
          error_msg: errorMessage,
          request_id: requestId,
          status_code: statusCode,
        },
        statusCode
      );
    }
  }

  export class LiriumOperationForbiddenException extends LiriumApiException {
    constructor(errorMessage: string, requestId: string) {
      super('operation_forbidden_for_customer', errorMessage, requestId, 403);
    }
  }
  
  export class LiriumValidationException extends LiriumApiException {
    constructor(errorMessage: string, requestId: string) {
      super('validation_error', errorMessage, requestId, 400);
    }
  }
  
  export class LiriumInternalErrorException extends LiriumApiException {
    constructor(errorMessage: string, requestId: string) {
      super('internal_error', errorMessage, requestId, 500);
    }
  }