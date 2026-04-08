import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import {
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from 'apps/deposit/src/dto/lirium.dto';
import { OperationType } from 'apps/deposit/src/dto/order.dto';
import {
  ConfirmWithdrawRequestDto,
  WithdrawRequestDto,
  WithdrawResponseDto,
  WithdrawStateResponseDto,
} from '../dto/withdraw.dto';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly databaseService: DatabaseService,
  ) { }

  private async getCustomer(accountId: string, companyId: string): Promise<string> {
    const result = await this.databaseService.pool.query<string[]>(
      'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
      [accountId, companyId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`user with account id ${accountId} not found`);
    }

    return result.rows[0].user_id;
  }

  async createWithdraw(
    accountId: string,
    body: WithdrawRequestDto,
    companyId: string,
  ): Promise<WithdrawResponseDto> {
    const customerId = await this.getCustomer(accountId, companyId);
    if (!body.network) {
      throw new BadRequestException('Send network is required');
    }

    if (!body.destination?.type) {
      throw new BadRequestException('Send destination type is required');
    }

    if (!body.destination?.value) {
      throw new BadRequestException('Send destination value is required');
    }

    if (!body.assetAmount && !body.destination?.amount) {
      throw new BadRequestException(
        'Either assetAmount or destination.amount is required',
      );
    }
    const orderRequest: LiriumOrderRequestDto = {
      customer_id: customerId,
      reference_id:
        body.referenceId ??
        `Send${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`,
      operation: OperationType.SEND,
      asset: {
        currency: body.currency,
        amount: body.assetAmount,
      },
      send: {
        network: body.network,
        destination: {
          type: body.destination.type,
          value: body.destination.value,
          amount: body.destination.amount,
        },
      },
    };

    const response: LiriumOrderResponseDto =
      await this.liriumRequestService.createOrder(orderRequest);

    return {
      withdrawId: response.id,
      status: response.state,
      requiresConfirmationCode:
        response.send?.requires_confirmation_code ?? false,
      expiresAt: response.send?.expires_at,
    };
  }

  async confirmWithdraw(
    accountId: string,
    withdrawId: string,
    body: ConfirmWithdrawRequestDto,
    companyId: string,
  ): Promise<WithdrawResponseDto> {
    const customerId = await this.getCustomer(accountId, companyId);

    const request: LiriumOrderConfirmRequestDto = {
      customer_id: customerId,
      order_id: withdrawId,
      confirmation_code: body.confirmationCode,
    };

    const response = await this.liriumRequestService.confirmOrder(request);

    return {
      withdrawId: response.id,
      status: response.state,
      requiresConfirmationCode:
        response.send?.requires_confirmation_code ?? false,
      expiresAt: response.send?.expires_at,
    };
  }

  async getWithdrawState(
    accountId: string,
    withdrawId: string,
    companyId: string,
  ): Promise<WithdrawStateResponseDto> {
    const customerId = await this.getCustomer(accountId, companyId);
    const response = await this.liriumRequestService.getOrder(customerId, withdrawId);

    return {
      withdrawId: response.id,
      operation: response.operation,
      status: response.state,
      currency: response.asset.currency,
      assetAmount: response.asset.amount,
      network: response.send?.network,
      destinationType: response.send?.destination?.type,
      destinationValue: response.send?.destination?.value,
      destinationAmount: response.send?.destination?.amount,
      fees: response.send?.fees,
      requiresConfirmationCode: response.send?.requires_confirmation_code,
      expiresAt: response.send?.expires_at,
      transactionId:
        response.send?.destination?.crypto_currency_transaction?.transaction_id,
      createdAt: response.created_at,
      submittedAt: response.submitted_at,
      lastUpdatedAt: response.last_updated_at,
    };
  }

  async resendWithdrawConfirmationCode(
    accountId: string,
    withdrawId: string,
    companyId: string,
  ): Promise<void> {
    const customerId = await this.getCustomer(accountId, companyId);
    await this.liriumRequestService.resendOrderConfirmationCode(
      customerId,
      withdrawId,
    );
  }
}