import { Module } from '@nestjs/common';
import { SharedModule } from 'libs/shared';
import { DepositListenerController } from './deposit-listener.controller';
import { ListenerService } from './services/listener.service';

@Module({
  imports: [SharedModule],
  controllers: [DepositListenerController],
  providers: [ListenerService],
  exports: [],
})
export class DepositModule {}
