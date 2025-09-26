import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Param,
  Header,
  NotFoundException,
} from '@nestjs/common';

import { AddWalletRequestDto } from './dto/add-wallet.dto';
import { AddWalletResponseDto } from './dto/add-wallet.dto';
import { globalRegistry, MetricsService } from './metrics.service';
import { LiriumRequestServiceAbstract } from 'libs/shared';
import { GetWalletsService } from './src/get-wallets.service';

@Controller()
export class WalletServiceController {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly metricsService: MetricsService,
    private readonly getWalletsService: GetWalletsService,
  ) {}

  @Post('addWallet')
  async addWallet(
    @Body() body: AddWalletRequestDto,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.liriumRequestService.createCustomer(body);

      return {
        message: result.address == null || result.address.length === 0 ? 'Warning' : 'Success',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Get('wallet/:userId')
  async getWallet(
    @Param('userId') userId: string,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.getWalletsService.getWallets(userId);
      return {
        message: result.address == null || result.address.length === 0 ? 'Warning' : 'Success',
        data: result,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`user with id ${userId} not found`);
      }

      throw new BadRequestException(error);
    }
  }

  @Get('metrics')
  @Header('Content-Type', globalRegistry.contentType)
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
