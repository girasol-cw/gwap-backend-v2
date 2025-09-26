import { Module } from '@nestjs/common';
import { DatabaseService } from '../../../libs/shared/src/services/database.service';
import { OrderController } from './order.controller';
import { CustomerController } from './customer.controller';
import { SharedModule } from 'libs/shared';
import { DepositListenerController } from './deposit-listener.controller';

@Module({
  imports: [SharedModule],
  controllers: [OrderController, CustomerController, DepositListenerController],
  providers: [DatabaseService],
  exports: [],
})
export class DepositModule {}
