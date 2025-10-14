import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'libs/shared';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { OrderRequestDto } from '../dto/order.dto';
import { LiriumOrderRequestDto } from '../dto/lirium.dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  async createOrder(order: OrderRequestDto) {
    this.logger.log(`Creating order ${order}`);
    const liriumOrder: LiriumOrderRequestDto = {
      customer_id: order.userId,
      reference_id: 'Sell' + new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
      operation: order.operationType,
      asset: order.asset,
    };
  }
}
