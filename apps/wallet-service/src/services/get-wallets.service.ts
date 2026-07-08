import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { AddWalletResponseDto } from '../dto/add-wallet.dto';
import { DatabaseService } from 'libs/shared/src/services/database.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetWalletsService {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly databaseService: DatabaseService,
  ) {}

  async getWallets(accountId: string, companyId: string): Promise<AddWalletResponseDto> {
    const customer = await this.getCustomer(accountId, companyId);
    const wallets = await this.liriumRequestService.getWallets(customer.user_id);
    const response = new AddWalletResponseDto();
    response.id = customer.user_id;
    response.accountId = accountId;
    response.email = customer.email;
    response.address = wallets.address ?? [];
    return response;
  }

  private async getCustomer(
    accountId: string,
    companyId: string,
  ): Promise<{ user_id: string; email: string }> {
    const result = await this.databaseService.pool.query<{ user_id: string; email: string }>(
      'SELECT user_id, email FROM users WHERE girasol_account_id = $1 AND company_id = $2',
      [accountId, companyId],
    );

    if (result.rows.length === 0) {
      throw new Error(`user with account id ${accountId} not found`);
    }

    return result.rows[0];
  }
}
