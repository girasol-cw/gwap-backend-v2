import {
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'libs/shared/src/services/database.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import {
  CustomerDataSource,
  CustomerSourceErrorDto,
  UnifiedCustomerResponseDto,
} from '../dto/customer.dto';

@Injectable()
export class GetCustomerService {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly databaseService: DatabaseService,
  ) {}

  async getCustomer(
    accountId: string,
    companyId: string,
  ): Promise<UnifiedCustomerResponseDto> {
    const customer = await this.getLocalCustomer(accountId, companyId);

    const [wallets, accounts, details] = await Promise.allSettled([
      this.liriumRequestService.getWallets(customer.user_id),
      this.liriumRequestService.getCustomerAccount(customer.user_id),
      this.liriumRequestService.getCustomerDetails(customer.user_id),
    ]);

    const failedSources: CustomerDataSource[] = [];
    const response = new UnifiedCustomerResponseDto();
    response.id = customer.user_id;
    response.accountId = accountId;
    response.email = customer.email;

    if (wallets.status === 'fulfilled') {
      response.wallets = {
        success: true,
        data: wallets.value,
        error: null,
      };
    } else {
      failedSources.push('wallets');
      response.wallets = {
        success: false,
        data: null,
        error: this.mapSourceError('wallets', wallets.reason),
      };
    }

    if (accounts.status === 'fulfilled') {
      response.accounts = {
        success: true,
        data: accounts.value,
        error: null,
      };
    } else {
      failedSources.push('accounts');
      response.accounts = {
        success: false,
        data: null,
        error: this.mapSourceError('accounts', accounts.reason),
      };
    }

    if (details.status === 'fulfilled') {
      response.details = {
        success: true,
        data: details.value,
        error: null,
      };
    } else {
      failedSources.push('details');
      response.details = {
        success: false,
        data: null,
        error: this.mapSourceError('details', details.reason),
      };
    }

    response.failedSources = failedSources;
    response.partialSuccess = failedSources.length > 0;
    return response;
  }

  private async getLocalCustomer(
    accountId: string,
    companyId: string,
  ): Promise<{ user_id: string; email: string }> {
    const result = await this.databaseService.pool.query<{ user_id: string; email: string }>(
      'SELECT user_id, email FROM users WHERE girasol_account_id = $1 AND company_id = $2',
      [accountId, companyId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Customer with account id ${accountId} not found`);
    }

    return result.rows[0];
  }

  private mapSourceError(
    source: CustomerDataSource,
    error: unknown,
  ): CustomerSourceErrorDto {
    const response = new CustomerSourceErrorDto();
    response.source = source;

    if (error instanceof HttpException) {
      response.message = error.message;
      response.statusCode = error.getStatus();
      return response;
    }

    if (error instanceof Error) {
      response.message = error.message;
      return response;
    }

    response.message = 'Unknown error';
    return response;
  }
}
