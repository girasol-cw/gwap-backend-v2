import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { WalletServiceController } from './wallet-service.controller';
import { SharedModule } from 'libs/shared';
import { GetWalletsService } from './services/get-wallets.service';
import { WithdrawService } from './services/withdraw.service';
import { OrderService } from './services/order.service';

@Module({
  imports: [SharedModule],
  controllers: [WalletServiceController],
  providers: [MetricsService, GetWalletsService, WithdrawService, OrderService],
  exports: []
})
export class WalletServiceModule { }
