import { Module } from '@nestjs/common';
import { DatabaseService } from '../../api/src/common/database.service';
import { OrderController } from './order.controller';
import { CustomerController } from './customer.controller';
import { SharedModule } from 'libs/shared';
import { DepositListenerController } from './deposit-listener.controller';

@Module({
  imports: [SharedModule],
  controllers: [OrderController, CustomerController, DepositListenerController],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DepositModule {}
