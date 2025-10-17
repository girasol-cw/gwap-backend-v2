import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { CustomerController } from './customer.controller';
import { SharedModule } from 'libs/shared';
import { DepositListenerController } from './deposit-listener.controller';
import { ListenerService } from './services/listener.service';
import { OrderService } from './services/order.Service';

@Module({
  imports: [SharedModule],
  controllers: [OrderController, CustomerController, DepositListenerController],
  providers: [ ListenerService, OrderService],
  exports: [],
})
export class DepositModule {}
