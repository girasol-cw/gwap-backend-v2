import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipCompanyId } from 'libs/shared';
import { Request } from 'express';
import { SkipApiKey } from '../common/skip-api-key.decorator';
import { LiriumWebhookService } from '../services/lirium-webhook.service';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

@ApiTags('Lirium Webhooks')
@Controller('webhooks/lirium')
export class LiriumWebhookController {
  constructor(private readonly liriumWebhookService: LiriumWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipApiKey()
  @SkipCompanyId()
  @ApiHeader({
    name: 'X-JWT-SIGNATURE',
    description: 'RS512 JWT signature provided by Lirium',
    required: true,
  })
  @ApiOperation({
    summary: 'Receive Lirium webhook events',
    description: 'Validates the Lirium webhook signature and stores receive order deposits.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Webhook accepted and processed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid webhook signature',
  })
  async handleWebhook(
    @Headers('x-jwt-signature') signature: string | undefined,
    @Req() req: RawBodyRequest,
    @Body() body: Record<string, unknown>,
  ): Promise<void> {
    await this.liriumWebhookService.handleWebhook(signature, req.rawBody, body);
  }
}
