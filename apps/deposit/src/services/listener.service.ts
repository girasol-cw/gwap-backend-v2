import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'libs/shared/src/services/database.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import {
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from '../dto/lirium.dto';
import { AssetDto, OperationType } from '../dto/order.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class ListenerService {
  private readonly logger = new Logger(ListenerService.name);
  constructor(
    private readonly liriumService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  private readonly SQL = {
    getCustomers: 'SELECT user_id FROM Users ',
    saveDeposit: `INSERT INTO deposits (order_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5)`,
    updateDeposit: `UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3`,
  };

  async listen() {
    this.logger.log('Starting listener');
    await this.process();

    this.logger.log('Listener finished');
  }

  private async process() {
    const customers = await this.getCustomers();
    for (const customer of customers) {
      this.logger.log(`Getting customer account for ${customer}`);
      const customerAccount =
        await this.liriumService.getCustomerAccount(customer);
      if (customerAccount.accounts && customerAccount.accounts.length > 0) {
        for (const account of customerAccount.accounts) {
          await this.createDeposit(customer, account);
        }
      }
    }
  }

  private async getCustomers(): Promise<string[]> {
    this.logger.log('Getting customers');
    const result = await this.dbService.pool.query(this.SQL.getCustomers, []);
    return result.rows.map((row) => row.user_id);
  }

  private async createDeposit(customer: string, asset: AssetDto) {
    let value = Number(asset.amount);
    if (value <= 0) {
      this.logger.log(`Skipping deposit for ${customer} because amount is 0`);
      return;
    }
    this.logger.log(`Creating deposit for ${customer} ${asset}`);
    console.log('asset', asset);
    let liriumOrder: LiriumOrderRequestDto = {
      customer_id: customer,
      reference_id:
        'Sell' +
        new Date()
          .toISOString()
          .replace(/[-:T.]/g, '')
          .slice(0, 14),
      operation: OperationType.SELL,
      asset: asset,
    };

    try {
      this.logger.log(`Creating order for ${customer} ${asset}`);
      console.log('lirium-Order-Request', liriumOrder);
      liriumOrder.currency = asset.currency ?? '';
      const order = await this.liriumService.createOrder(liriumOrder);
      await this.saveDeposit(customer, order);
      await this.confirmDeposit(customer, order);
    } catch (error) {
      this.logger.error(
        `Error creating deposit for ${customer} ${asset}`,
        error,
      );
      return;
    }
  }

  private async confirmDeposit(
    customer: string,
    order: LiriumOrderResponseDto,
  ) {
    this.logger.log(`Confirming deposit for ${customer} `);
    console.log('order', order);
    const liriumOrder: LiriumOrderConfirmRequestDto = {
      customer_id: customer,
      order_id: order.id,
      customer: {
        currency: order.sell?.settlement?.currency ?? '',
        amount: order.sell?.settlement?.amount ?? '',
      },
    };
    console.log(`Lirium order confirm request ${liriumOrder}`);
    try {
      const confirmedOrder = await this.liriumService.confirmOrder(liriumOrder);
      await this.updateDeposit(customer, confirmedOrder);
    } catch (error) {
      this.logger.error(
        `Error confirming deposit for ${customer} ${order}`,
        error,
      );

      return;
    }
  }

  private async saveDeposit(customer: string, order: LiriumOrderResponseDto) {
    this.logger.log(`Saving deposit for ${customer} ${order}`);
    await this.dbService.pool.query(this.SQL.saveDeposit, [
      order.id,
      customer,
      order.asset.amount,
      order.state === 'confirmed',
      order.sell?.settlement?.amount,
    ]);
  }
  private async updateDeposit(customer: string, order: LiriumOrderResponseDto) {
    this.logger.log(`Updating deposit for ${customer} ${order}`);
    await this.dbService.pool.query(this.SQL.updateDeposit, [
      true,
      order.sell?.settlement?.amount,
      order.id,
    ]);
  }
}
