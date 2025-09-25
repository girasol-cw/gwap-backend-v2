import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Param,
  Header,
} from '@nestjs/common';

import { AddWalletRequestDto } from './dto/add-wallet.dto';
import { AddWalletResponseDto } from './dto/add-wallet.dto';
import { globalRegistry, MetricsService } from './metrics.service';
import { TokenLiriumServiceAbstract } from 'libs/shared';

@Controller()
export class WalletServiceController {
  constructor(
    private readonly tokenService: TokenLiriumServiceAbstract,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('addWallet')
  async addWallet(
    @Body() body: AddWalletRequestDto,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    const { email = null, accountId = null, userId = null } = body;

    try {
      let result: any;
      return {
        message:
          result.address == null || result.errorChainIds.length > 0
            ? 'Warning'
            : 'Success',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('wallet/:userId')
  async getWallet(
    @Param('userId') userId: string,
  ): Promise<AddWalletResponseDto> {
    const token = await this.tokenService.getToken();
    console.log(token);

    return new AddWalletResponseDto();
  }

  @Get('metrics')
  @Header('Content-Type', globalRegistry.contentType)
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
