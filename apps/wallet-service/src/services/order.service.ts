import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'libs/shared';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import {
  AssetDto,
  OperationType,
  OrderConfirmRequestDto,
  OrderRequestDto,
  SwapQuoteRequestDto,
  SwapQuoteResponseDto,
} from '../dto/order.dto';
import {
  LiriumExchangeRateDto,
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from '../dto/lirium.dto';

type OrderModel = {
  id: string;
  user_id: string;
  reference_id: string;
  operation: OperationType;
  asset: AssetDto;
  settlement?: AssetDto;
  status: string;
  created_at: string;
  order_body: string;
  order_response: string;
  network?: string;
  fees?: string;
  destination_type?: string;
  destination_value?: string;
  destination_amount?: string;
  requires_confirmation_code: boolean;
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) { }

  private readonly OPERATION_PREFIX = {
    [OperationType.SELL]: 'Sell',
    [OperationType.BUY]: 'Buy',
    [OperationType.SWAP]: 'Swap',
    [OperationType.SEND]: 'Send',
    [OperationType.SUBSCRIBE_INVESTMENT]: 'SubscribeInvestment',
    [OperationType.REDEEM_INVESTMENT]: 'RedeemInvestment',
  };

  private readonly SQL_QUERIES = {
    getCustomerId: 'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
    getOrder:
      'SELECT id, user_id, reference_id, operation, asset, settlement, status, created_at, order_body, order_response, network, fees, destination_type, destination_value, destination_amount, requires_confirmation_code FROM orders WHERE id = $1 AND company_id = $2',
    saveOrder:
      'INSERT INTO orders (id, company_id, user_id, reference_id, operation, asset, ' +
      'status, created_at, order_body, order_response, network, fees, destination_type, ' +
      ' destination_value, destination_amount, settlement, requires_confirmation_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)',
    updateOrderResponse:
      'UPDATE orders SET status = $1, order_response = $2, fees = $3, destination_amount = $4, requires_confirmation_code = $5 WHERE id = $6 AND company_id = $7',
  };

  async createOrder(order: OrderRequestDto, companyId: string): Promise<LiriumOrderResponseDto> {
    this.logger.log(`Creating order ${JSON.stringify(order)}`);
    const customerId = await this.getCustomerId(order.userId, companyId);
    order.userId = customerId;
    const liriumOrder = this.buildLiriumOrder(order);
    const orderResponse: LiriumOrderResponseDto = await this.liriumService.createOrder(liriumOrder);
    await this.saveOrder(liriumOrder, orderResponse, companyId);
    return orderResponse;
  }

  async confirmOrder(order: OrderConfirmRequestDto, companyId: string): Promise<LiriumOrderResponseDto> {
    const customerId = await this.getCustomerId(order.userId, companyId);
    if (!order.orderId) {
      throw new BadRequestException('Lirium Order ID is required');
    }

    const orderDto = await this.getOrder(order.orderId, companyId);

    const liriumOrder: LiriumOrderConfirmRequestDto = {
      customer_id: customerId,
      order_id: order.orderId,
    };

    if (order.confirmationCode) {
      liriumOrder.confirmation_code = order.confirmationCode;
    }

    if (orderDto.operation === OperationType.BUY || orderDto.operation === OperationType.SELL) {
      let currency: string | undefined = orderDto.settlement?.currency;
      let amount: string | undefined = orderDto.settlement?.amount;

      if (!amount) {
        currency = orderDto.asset?.currency;
        amount = orderDto.asset?.amount;
      }

      liriumOrder.customer = {
        currency: currency!,
        amount: amount!,
      };
    }

    const orderResponse = await this.liriumService.confirmOrder(liriumOrder);
    await this.updateOrder(orderResponse, companyId);
    return orderResponse;
  }

  async getOrderState(
    orderId: string,
    userId: string,
    companyId: string,
  ): Promise<LiriumOrderResponseDto> {
    const customerId = await this.getCustomerId(userId, companyId);
    await this.getOrder(orderId, companyId);
    return this.liriumService.getOrder(customerId, orderId);
  }

  async resendConfirmationCode(
    orderId: string,
    userId: string,
    companyId: string,
  ): Promise<void> {
    const customerId = await this.getCustomerId(userId, companyId);
    await this.getOrder(orderId, companyId);
    await this.liriumService.resendOrderConfirmationCode(customerId, orderId);
  }

  async getSwapQuote(
    body: SwapQuoteRequestDto,
  ): Promise<SwapQuoteResponseDto> {
    const rates: LiriumExchangeRateDto[] =
      await this.liriumService.getExchangeRates();

    const fromCurrency: string = body.asset.currency;
    const toCurrency: string = body.toCurrency;
    const amount: number = Number(body.asset.amount);

    if (fromCurrency === toCurrency) {
      throw new BadRequestException('Invalid currency pair');
    }

    if (!amount || isNaN(amount)) {
      throw new BadRequestException('Invalid amount');
    }

    const pair: LiriumExchangeRateDto | undefined = rates.find(
      (r: LiriumExchangeRateDto) => r.currency === toCurrency,
    );

    if (!pair) {
      throw new NotFoundException(
        `No exchange rate found for ${fromCurrency} -> ${toCurrency}`,
      );
    }

    const rawRate: string = pair.bid;
    const rate: number = Number(rawRate);

    if (!rate || isNaN(rate)) {
      throw new BadRequestException('Invalid exchange rate');
    }

    const estimated: number = amount * rate;

    return {
      from: body.asset,
      to: {
        currency: toCurrency,
        amount: estimated.toFixed(8),
      },
      rate: rawRate,
    };
  }

  private async getOrder(orderId: string, companyId: string): Promise<OrderModel> {
    const result = await this.dbService.pool.query<OrderModel>(
      this.SQL_QUERIES.getOrder,
      [orderId, companyId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }

    return result.rows[0];
  }

  private async updateOrder(
    order: LiriumOrderResponseDto,
    companyId: string,
  ): Promise<void> {
    await this.dbService.pool.query(
      this.SQL_QUERIES.updateOrderResponse,
      [
        order.state,
        JSON.stringify(order),
        order.send?.fees ?? null,
        order.send?.destination?.amount ?? order.swap?.amount ?? null,
        order.send?.requires_confirmation_code ??
        order.swap?.requires_confirmation_code ??
        false,
        order.id,
        companyId,
      ]
    );
  }

  private async saveOrder(
    order: LiriumOrderRequestDto,
    orderResponse: LiriumOrderResponseDto,
    companyId: string,
  ): Promise<void> {
    let settlement: AssetDto | undefined;
    let requiresConfirmationCode = false;
    let network: string | null = null;
    let fees: string | null = null;
    let destinationType: string | null = null;
    let destinationValue: string | null = null;
    let destinationAmount: string | null = null;

    if (order.operation === OperationType.SELL) {
      settlement = orderResponse.sell?.settlement;
      requiresConfirmationCode =
        orderResponse.sell?.requires_confirmation_code ?? false;
    } else if (order.operation === OperationType.BUY) {
      settlement = orderResponse.buy?.settlement;
      requiresConfirmationCode =
        orderResponse.buy?.requires_confirmation_code ?? false;
    } else if (order.operation === OperationType.SWAP) {
      if (!orderResponse.swap?.currency || !orderResponse.swap?.amount) {
        throw new BadRequestException('Invalid swap response from Lirium');
      }

      settlement = {
        currency: orderResponse.swap.currency,
        amount: orderResponse.swap.amount,
      };
      requiresConfirmationCode =
        orderResponse.swap?.requires_confirmation_code ?? false;
    } else if (order.operation === OperationType.SEND) {
      network = order.send?.network ?? null;
      fees = orderResponse.send?.fees ?? null;
      destinationType = order.send?.destination?.type ?? null;
      destinationValue = order.send?.destination?.value ?? null;
      destinationAmount =
        orderResponse.send?.destination?.amount ??
        order.send?.destination?.amount ??
        null;
      requiresConfirmationCode =
        orderResponse.send?.requires_confirmation_code ?? false;
    }

    await this.dbService.pool.query(
      this.SQL_QUERIES.saveOrder,
      [
        orderResponse.id,
        companyId,
        order.customer_id,
        order.reference_id,
        order.operation,
        order.asset,
        orderResponse.state,
        new Date().toISOString(),
        JSON.stringify(order),
        JSON.stringify(orderResponse),
        network,
        fees,
        destinationType,
        destinationValue,
        destinationAmount,
        settlement ?? null,
        requiresConfirmationCode,
      ],
    );
  }

  private buildLiriumOrder(order: OrderRequestDto): LiriumOrderRequestDto {
    const referenceId =
      order.referenceId ??
      this.OPERATION_PREFIX[order.operationType] +
      new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

    const liriumOrder: LiriumOrderRequestDto = {
      customer_id: order.userId,
      reference_id: referenceId,
      operation: order.operationType,
      asset: order.asset,
    };

    switch (order.operationType) {
      case OperationType.SELL:
        if (!order.tradeOperation) {
          throw new BadRequestException('Trade operation is required');
        }

        liriumOrder.sell = {
          settlement: order.tradeOperation.settlement,
          commission: order.tradeOperation.commission,
          expires_at: order.tradeOperation.expiresAt,
          requires_confirmation_code: order.tradeOperation.requiresConfirmationCode,
        };
        break;

      case OperationType.BUY:
        if (!order.tradeOperation) {
          throw new BadRequestException('Trade operation is required');
        }

        liriumOrder.buy = {
          settlement: order.tradeOperation.settlement,
          commission: order.tradeOperation.commission,
          expires_at: order.tradeOperation.expiresAt,
          requires_confirmation_code: order.tradeOperation.requiresConfirmationCode,
        };
        break;

      case OperationType.SWAP:
        if (!order.swap?.currency) {
          throw new BadRequestException('Swap currency is required');
        }

        liriumOrder.swap = {
          currency: order.swap.currency,
          amount: order.swap.amount ?? order.asset.amount,
        };
        break;

      case OperationType.SEND:
        if (!order.send?.network) {
          throw new BadRequestException('Send network is required');
        }

        if (!order.send?.destination?.type) {
          throw new BadRequestException('Send destination type is required');
        }

        if (!order.send?.destination?.value) {
          throw new BadRequestException('Send destination value is required');
        }

        if (!order.asset?.amount && !order.send?.destination?.amount) {
          throw new BadRequestException(
            'Either asset.amount or send.destination.amount is required',
          );
        }

        liriumOrder.send = {
          network: order.send.network,
          destination: {
            type: order.send.destination.type,
            value: order.send.destination.value,
            amount: order.send.destination.amount,
          },
        };
        break;

      default:
        this.logger.warn(
          `Operation type ${order.operationType} does not have specific mapping`,
        );
    }

    return liriumOrder;
  }

  private async getCustomerId(
    girasolAccountId: string,
    companyId: string,
  ): Promise<string> {
    const result = await this.dbService.pool.query<{ user_id: string }>(
      this.SQL_QUERIES.getCustomerId,
      [girasolAccountId, companyId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(
        `Customer with girasol account id ${girasolAccountId} not found`,
      );
    }

    return result.rows[0].user_id;
  }
}
