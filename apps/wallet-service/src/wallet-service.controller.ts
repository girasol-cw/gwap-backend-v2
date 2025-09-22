import { Controller, Post, Body, BadRequestException, Get, NotFoundException, Param, Header } from '@nestjs/common';
import { WalletService } from './src/wallet-service.service';
import { AddWalletRequestDto } from './dto/add-wallet.dto';
import { AddWalletResponseDto } from './dto/add-wallet.dto';
import { globalRegistry, MetricsService } from './metrics.service';

@Controller()
export class WalletServiceController {
  constructor(private readonly walletService: WalletService, private readonly metricsService: MetricsService) { }

  @Post('addWallet')
  async addWallet(
    @Body() body: AddWalletRequestDto
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    const { email = null, accountId = null, userId = null } = body;

    try {
      let result:any;
      return {
        message: result.address == null || result.errorChainIds.length > 0 ? 'Warning' : 'Success',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('wallet/:userId')
  async getWallet(@Param('userId') userId: string): Promise<AddWalletResponseDto> {
  

    return new AddWalletResponseDto();
  }

  @Get('metrics')
  @Header('Content-Type', globalRegistry.contentType)
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }


}
