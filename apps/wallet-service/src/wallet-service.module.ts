import { Module } from '@nestjs/common';

import { WalletService } from './src/wallet-service.service';
import { MetricsService } from './metrics.service';
import { DatabaseService } from 'apps/api/src/common/database.service';
import { WalletServiceController } from './wallet-service.controller';

@Module({
  imports: [],
  controllers: [WalletServiceController],
  providers: [WalletService, MetricsService,DatabaseService],
  exports: [DatabaseService]
})
export class WalletServiceModule { }
