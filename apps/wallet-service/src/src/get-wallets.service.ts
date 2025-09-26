import { LiriumRequestServiceAbstract } from 'libs/shared/src/services/lirium-request.service';
import { AddWalletResponseDto } from '../dto/add-wallet.dto';
import { DatabaseService } from 'libs/shared/src/services/database.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetWalletsService {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly databaseService: DatabaseService,
  ) {}

  async getWallets(accountId: string): Promise<AddWalletResponseDto> {
    const customer = await this.getCustomer(accountId);
    return this.liriumRequestService.getWallets(customer);
  }

  private async getCustomer(accountId: string): Promise<string> {
    const result = await this.databaseService.pool.query<string[]>(
      'SELECT user_id FROM users WHERE girasol_account_id = $1',
      [accountId],
    );

    if (result.rows.length === 0) {
      throw new Error(`user with account id ${accountId} not found`);
    }

    return result.rows[0].user_id;
  }
}
