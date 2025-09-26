import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { WalletServiceController } from './wallet-service.controller';
import { SharedModule } from 'libs/shared';
import { GetWalletsService } from './src/get-wallets.service';

@Module({
  imports: [SharedModule],
  controllers: [WalletServiceController],
  providers: [ MetricsService, GetWalletsService],
  exports: []
})
export class WalletServiceModule { }
