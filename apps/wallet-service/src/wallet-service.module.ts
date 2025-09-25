import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { DatabaseService } from 'apps/api/src/common/database.service';
import { WalletServiceController } from './wallet-service.controller';
import { SharedModule } from 'libs/shared';

@Module({
  imports: [SharedModule],
  controllers: [WalletServiceController],
  providers: [ MetricsService,DatabaseService],
  exports: [DatabaseService]
})
export class WalletServiceModule { }
