import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from 'libs/shared';

type ForwardableDepositRow = {
  account: string;
  amount: string | null;
  companyId: string;
  currency: string | null;
  email: string;
  fees: string | null;
  orderId: string;
  txHash: string | null;
};

@Injectable()
export class DepositForwarderService {
  private readonly logger = new Logger(DepositForwarderService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async forwardDeposit(orderId: string, companyId?: string): Promise<boolean> {
    const deposit = await this.claimDeposit(orderId, companyId);
    if (!deposit) {
      return false;
    }

    try {
      const response = await axios.post(process.env.SEND_URL!, this.buildPayload(deposit), {
        headers: this.getHeaders(deposit.companyId),
      });

      if (response.status >= 200 && response.status < 300) {
        await this.markSent(orderId, response.data);
        return true;
      }

      await this.markFailed(orderId, `Unexpected response status: ${response.status}`);
      return false;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const responseData = error.response.data;
        const duplicateMessage =
          typeof responseData?.data === 'string'
            ? responseData.data
            : typeof responseData?.message === 'string'
              ? responseData.message
              : '';

        if (
          status === 409 &&
          duplicateMessage.includes('Transaction with this txHash already exists')
        ) {
          await this.markSent(orderId, responseData);
          this.logger.warn(
            `Deposit ${orderId} already exists upstream. Marked as sent locally.`,
          );
          return true;
        }

        await this.markFailed(
          orderId,
          `HTTP ${status}: ${JSON.stringify(responseData)}`,
        );
        this.logger.error(`Failed to forward deposit ${orderId}: ${error.message}`);
        return false;
      }

      const message = error instanceof Error ? error.message : 'Unknown forward error';
      await this.markFailed(orderId, message);
      this.logger.error(`Unexpected forward error for deposit ${orderId}: ${message}`);
      return false;
    }
  }

  private buildPayload(row: ForwardableDepositRow): Record<string, unknown> {
    return {
      txHash: row.txHash,
      orderId: row.orderId,
      email: row.email,
      account: row.account,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      gasFee: row.fees ? Number(row.fees) : 0,
      currencyCode: 840,
      merchant: 'CFX',
      paymentType: 'crypto',
    };
  }

  private async claimDeposit(
    orderId: string,
    companyId?: string,
  ): Promise<ForwardableDepositRow | null> {
    const client = await this.databaseService.pool.connect();

    try {
      await client.query('BEGIN');

      const params: Array<string> = [orderId];
      const companyFilter = companyId ? 'AND d.company_id = $2' : '';
      if (companyId) {
        params.push(companyId);
      }

      const result = await client.query<ForwardableDepositRow>(
        `SELECT
          d.order_id AS "orderId",
          d.company_id AS "companyId",
          COALESCE(d.amount_usd, d.erc20_amount) AS "amount",
          d.currency AS "currency",
          d.origin_value AS "txHash",
          d.payload #>> '{order,receive,fees}' AS "fees",
          u.email AS "email",
          u.girasol_account_id AS "account"
        FROM deposits d
        JOIN users u ON u.user_id = d.user_id
        WHERE d.order_id = $1
          ${companyFilter}
          AND d.forward_status IN ('pending', 'failed')
        FOR UPDATE`,
        params,
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `UPDATE deposits
         SET forward_status = 'sending',
             forward_attempts = forward_attempts + 1,
             forward_last_error = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private getHeaders(companyId: string): Record<string, string> {
    return {
      'x-api-key': process.env.GIRASOL_API_KEY!,
      'x-secret-key': process.env.GIRASOL_SECRET_KEY!,
      'x-company-id': companyId,
      'Content-Type': 'application/json',
    };
  }

  private async markFailed(orderId: string, error: string): Promise<void> {
    await this.databaseService.pool.query(
      `UPDATE deposits
       SET forward_status = 'failed',
           forward_last_error = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1`,
      [orderId, error],
    );
  }

  private async markSent(orderId: string, responseBody: unknown): Promise<void> {
    await this.databaseService.pool.query(
      `UPDATE deposits
       SET forward_status = 'sent',
           forward_response = $2,
           forwarded_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1`,
      [orderId, responseBody],
    );
  }
}
