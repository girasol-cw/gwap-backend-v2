import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { WalletServiceController } from './wallet-service.controller';
import { SharedModule } from 'libs/shared';
import { GetWalletsService } from './services/get-wallets.service';
import { WithdrawService } from './services/withdraw.service';
import { OrderService } from './services/order.service';
import { LiriumWebhookController } from './controllers/lirium-webhook.controller';
import { LiriumWebhookService } from './services/lirium-webhook.service';

@Module({
  imports: [SharedModule],
  controllers: [WalletServiceController, LiriumWebhookController],
  providers: [
    MetricsService,
    GetWalletsService,
    WithdrawService,
    OrderService,
    LiriumWebhookService,
  ],
  exports: []
})
export class WalletServiceModule { }
