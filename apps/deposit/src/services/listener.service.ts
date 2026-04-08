import { DatabaseService } from 'libs/shared/src/services/database.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import {
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from '../dto/lirium.dto';
import { AssetDto, OperationType } from '../dto/order.dto';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ListenerService {
  private readonly logger = new Logger(ListenerService.name);
  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) { }

  private readonly SQL = {
    getCustomers: 'SELECT user_id FROM users WHERE company_id = $1',
    saveDeposit: `INSERT INTO deposits (order_id, company_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5, $6)`,
    updateDeposit: `UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3 AND company_id = $4`,
  };

  async listen(companyId: string) {
    this.logger.log('Starting listener');
    await this.process(companyId);
    this.logger.log('Listener finished');
  }

  private async process(companyId: string) {
    const customers = await this.getCustomers(companyId);
    for (const customer of customers) {
      this.logger.log(`Getting customer account for ${customer}`);
      const customerAccount =
        await this.liriumService.getCustomerAccount(customer);
      if (customerAccount.accounts && customerAccount.accounts.length > 0) {
        for (const account of customerAccount.accounts) {
          await this.createDeposit(customer, account, companyId);
        }
      }
    }
  }

  private async getCustomers(companyId: string): Promise<string[]> {
    this.logger.log('Getting customers');
    const result = await this.dbService.pool.query(this.SQL.getCustomers, [companyId]);
    return result.rows.map((row) => row.user_id);
  }

  private async createDeposit(customer: string, asset: AssetDto, companyId: string) {
    const value = Number(asset.amount);
    if (!value || value <= 0) {
      this.logger.log(`Skipping deposit for ${customer} because amount is invalid`);
      return;
    }
    this.logger.log(`Creating deposit for ${customer} ${JSON.stringify(asset)}`);
    this.logger.debug('asset', asset);
    const liriumOrder: LiriumOrderRequestDto = {
      customer_id: customer,
      reference_id:
        'Sell' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      operation: OperationType.SELL,
      asset,
      sell: {
        settlement: {
          currency: asset.currency,
          amount: asset.amount,
        },
      },
    };

    try {
      this.logger.log(`Creating order for ${customer} ${JSON.stringify(asset)}`);
      this.logger.debug('lirium-Order-Request', liriumOrder);
      const order = await this.liriumService.createOrder(liriumOrder);
      await this.saveDeposit(customer, order, companyId);
      await this.confirmDeposit(customer, order, companyId);
    } catch (error) {
      this.logger.error(
        `Error creating deposit for ${customer} ${JSON.stringify(asset)}`,
        error,
      );
      return;
    }
  }

  private async confirmDeposit(
    customer: string,
    order: LiriumOrderResponseDto,
    companyId: string,
  ) {
    this.logger.log(`Confirming deposit for ${customer} `);
    this.logger.debug('order', order);
    const currency =
      order.sell?.settlement?.currency ?? order.asset?.currency ?? '';

    const amount =
      order.sell?.settlement?.amount ?? order.asset?.amount ?? '';

    const liriumOrder: LiriumOrderConfirmRequestDto = {
      customer_id: customer,
      order_id: order.id,
      customer: {
        currency,
        amount,
      },
    };
    this.logger.debug('Lirium order confirm request', liriumOrder);
    try {
      const confirmedOrder = await this.liriumService.confirmOrder(liriumOrder);
      await this.updateDeposit(customer, confirmedOrder, companyId);
    } catch (error) {
      this.logger.error(
        `Error confirming deposit for ${customer} ${JSON.stringify(order)}`,
        error,
      );

      return;
    }
  }

  private async saveDeposit(customer: string, order: LiriumOrderResponseDto, companyId: string) {
    this.logger.log(`Saving deposit for ${customer} ${JSON.stringify(order)}`);
    await this.dbService.pool.query(this.SQL.saveDeposit, [
      order.id,
      companyId,
      customer,
      order.asset.amount,
      order.state === 'confirmed',
      order.sell?.settlement?.amount,
    ]);
  }
  private async updateDeposit(customer: string, order: LiriumOrderResponseDto, companyId: string) {
    this.logger.log(`Updating deposit for ${customer} ${JSON.stringify(order)}`);
    await this.dbService.pool.query(this.SQL.updateDeposit, [
      true,
      order.sell?.settlement?.amount,
      order.id,
      companyId,
    ]);
  }
}
