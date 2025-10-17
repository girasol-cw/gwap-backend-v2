import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'libs/shared';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { AssetDto, OperationType, OrderConfirmRequestDto, OrderDto, OrderRequestDto } from '../dto/order.dto';
import {
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from '../dto/lirium.dto';
import { OrderModel } from '../models/order';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  private readonly OPERATION_PREFIX = {
    [OperationType.SELL]: 'Sell',
    [OperationType.BUY]: 'Buy',
    [OperationType.SWAP]: 'Swap',
    [OperationType.SEND]: 'Send',
    [OperationType.SUBSCRIBE_INVESTMENT]: 'SubscribeInvestment',
    [OperationType.REDEEM_INVESTMENT]: 'RedeemInvestment',
  };

  private readonly SQL_QUERIES = {
    getCustomerId: 'SELECT user_id FROM users WHERE girasol_account_id = $1',
    getOrder:'SELECT ASSET,SETTLEMENT,STATUS, REFERENCE_ID FROM orders WHERE id = $1',
    saveOrder:
      'INSERT INTO orders (id, user_id, reference_id, operation, asset, ' +
      'status, created_at, order_body, order_response, network, fees, destination_type, ' +
      ' destination_value, destination_amount, settlement, requires_confirmation_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
    confirmOrder: 'UPDATE orders SET status = $1 WHERE id = $2',
  };

  async createOrder(order: OrderRequestDto): Promise<LiriumOrderResponseDto> {
    this.logger.log(`Creating order ${order}`);
    const customerId = await this.getCustomerId(order.userId);
    order.userId = customerId;
    const liriumOrder = this.buildLiriumOrder(order);
    console.log('liriumOrder', liriumOrder);
    const orderResponse :LiriumOrderResponseDto= await this.liriumService.createOrder(liriumOrder);
    console.log('orderResponse', orderResponse);
    await this.saveOrder(liriumOrder, orderResponse);
    return orderResponse;
  }

  async confirmOrder(order: OrderConfirmRequestDto): Promise<LiriumOrderResponseDto> {
    this.logger.log(`Confirming order with id ${order.orderId}`);
    const customerId = await this.getCustomerId(order.userId);
    if (!order.orderId) {
      throw new BadRequestException('Lirium Order ID is required');
    }
    order.userId = customerId;
    const orderDto = await this.getOrder(order.orderId!);

    let currency = orderDto.settlement?.currency;
    let amount = orderDto.settlement?.amount;
    if(!amount) {
     currency = orderDto.asset?.currency;
     amount = orderDto.asset?.amount;
    }

    const liriumOrder: LiriumOrderConfirmRequestDto = {
      customer_id: customerId,
      order_id: order.orderId!,
      customer: {
        currency: currency!,
        amount: amount!,
      },
    };
   
    const orderResponse = await this.liriumService.confirmOrder(liriumOrder);
    await this.updateOrder(orderResponse);
    return orderResponse;
  }

  private async getOrder(orderId: string): Promise<OrderModel> {
    const result = await this.dbService.pool.query<OrderModel>(
      this.SQL_QUERIES.getOrder,
      [orderId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }
    const orderModel = result.rows[0];
    console.log('orderModel', orderModel);
    
    return orderModel;
  }
  private async updateOrder(order: LiriumOrderResponseDto): Promise<void> {
    this.logger.log(`Updating order ${order}`);
    await this.dbService.pool.query(this.SQL_QUERIES.confirmOrder, [
      order.state,
      order.id,
    ]);
  }

  private async saveOrder(
    order: LiriumOrderRequestDto,
    orderResponse: LiriumOrderResponseDto,
  ) {
    this.logger.log(`Saving order ${orderResponse}`);
    this.logger.log(`Order body ${order}`);

    let settlement: AssetDto | undefined;
    let requiresConfirmationCode: boolean = false;
    if(order.operation === OperationType.SELL) {
      settlement = orderResponse.sell?.settlement;
      requiresConfirmationCode = order.sell?.requiresConfirmationCode ?? false;
    } else if(order.operation === OperationType.BUY) {
      settlement = orderResponse.buy?.settlement;
      requiresConfirmationCode = order.buy?.requiresConfirmationCode ?? false;
    } 


    const result = await this.dbService.pool.query<string[]>(
      this.SQL_QUERIES.saveOrder,
      [
        orderResponse.id,
        order.customer_id,
        order.reference_id,
        order.operation,
        order.asset,
        orderResponse.state,
        new Date().toISOString(),
        JSON.stringify(order),
        JSON.stringify(orderResponse),
        null,
        null,
        null,
        null,
        null,
        settlement,
        requiresConfirmationCode,
      ],
    );
  }

  private buildLiriumOrder(order: OrderRequestDto) {
    const referenceId =
      this.OPERATION_PREFIX[order.operationType] +
      new Date()
        .toISOString()
        .replace(/[-:T.]/g, '')
        .slice(0, 14);
    const liriumOrder: LiriumOrderRequestDto = {
      customer_id: order.userId,
      reference_id: referenceId,
      operation: order.operationType,
      asset: order.asset,
    };

    switch (order.operationType) {
      case OperationType.SELL:
        liriumOrder.sell = order.asset;
        break;
      case OperationType.BUY:
        liriumOrder.buy = order.tradeOperation?.settlement || order.asset;
        break;
      case OperationType.SEND:
        console.log('order.send', order.send);
        if(!order.send?.network || !order.send?.destination) {
          throw new BadRequestException('Network and destination are required');
        }
        liriumOrder.asset = order.asset;
        liriumOrder.send={
          network: order.send?.network!,
          destination: order.send!.destination!,
        }
        break;
      default:
        this.logger.warn(
          `Operation type ${order.operationType} does not have specific mapping`,
        );
    }
    return liriumOrder;
  }

  private async getCustomerId(girasolAccountId: string): Promise<string> {
    const result = await this.dbService.pool.query<string[]>(
      this.SQL_QUERIES.getCustomerId,
      [girasolAccountId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(
        `Customer with girasol account id ${girasolAccountId} not found`,
      );
    }
    return result.rows[0].user_id;
  }
}
