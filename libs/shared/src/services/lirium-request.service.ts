import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import {
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from 'apps/deposit/src/dto/lirium.dto';
import { LiriumCustomerAccountResponseDto } from 'apps/deposit/src/dto/lirium.dto';
import {
  AddWalletRequestDto,
  AddWalletResponseDto,
  walletDto,
} from 'apps/wallet-service/src/dto/add-wallet.dto';
import { HttpWrapperService } from './http-wrapper.service';
import { LiriumRequestDto } from '../dto/lirium-request.dto';
import { DatabaseService } from './database.service';
import { LiriumRequestServiceAbstract } from '../interfaces/lirium-request.service.abstract';

@Injectable()
export class LiriumRequestService extends LiriumRequestServiceAbstract {
  constructor(
    private readonly httpService: HttpWrapperService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async getCustomerAccount(
    customerId: string,
  ): Promise<LiriumCustomerAccountResponseDto> {
    const response =
      await this.httpService.get<LiriumCustomerAccountResponseDto>(
        `${process.env.LIRIUM_API_URL}/customers/${customerId}/accounts`,
      );
    return response.data;
  }
  async getWallets(accountId: string): Promise<AddWalletResponseDto> {
    const response = await this.httpService.get<any>(
      `${process.env.LIRIUM_API_URL}/customers/${accountId}/receiving_addresses`,
    );
    debugger;
    const responseDto = new AddWalletResponseDto();
    if (
      !response.data?.receiving_addresses ||
      response.data?.receiving_addresses.length === 0
    ) {
      return responseDto;
    }
    responseDto.address = response.data.receiving_addresses.map(
      (wallet: walletDto) => ({
        address: wallet.address,
        network: wallet.network,
        currency: wallet.currency,
        asset_type: wallet.asset_type,
      }),
    );
    return responseDto;
  }

  async createCustomer(
    customer: AddWalletRequestDto,
  ): Promise<AddWalletResponseDto> {
    const requestBody: LiriumRequestDto = {
      type: customer.userType,
      reference_id: customer.userId + Date.now().toString(),
      profile: {
        label: customer.label,
        first_name: customer.firstName,
        middle_name: customer.middleName,
        last_name: customer.lastName,
        date_of_birth: customer.birthDate,
        national_id_country: customer.nationalIdCountryIso2,
        national_id_type: 'national_id',
        national_id: customer.nationalId,
        citizenship: customer.citizenshipIso2,
        address_line1: customer.addressLine1,
        address_line2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        country: customer.countryIso2,
        zip_code: customer.zipCode,
        tax_id: customer.taxId,
        tax_country: customer.taxCountryIso2,
        cellphone: customer.cellphone,
        name: customer.name,
      },
      contact: {
        email: customer.email,
        cellphone: customer.cellphone,
      },
    };

    const customerDoesExist = await this.verifyCustomerDoesExist(customer);
    if (customerDoesExist) {
      throw new BadRequestException(
        `Customer with girasol account id ${customer.accountId} already exists`,
      );
    }

    const response = await this.httpService.post<any>(
      `${process.env.LIRIUM_API_URL}/customers`,
      requestBody,
    );
    const responseDto = new AddWalletResponseDto();
    const responseBody = response.data as LiriumRequestDto;
    const responseJson = JSON.stringify(response.data);
    responseBody.customer = responseJson;
    this.saveCustomer(responseBody, customer.accountId);

    responseDto.email = responseBody.contact.email;
    responseDto.accountId = responseBody.id ?? '';
    const address = await this.getWallets(responseBody.id!);
    await this.saveWallet(address, responseBody.id!);
    address.userId = responseBody.id!;
    console.log('address to return', address);
    return address;
  }

  private async verifyCustomerDoesExist(
    customer: AddWalletRequestDto,
  ): Promise<boolean> {
    const result = await this.databaseService.pool.query<string[]>(
      'SELECT user_id FROM users WHERE girasol_account_id = $1',
      [customer.accountId],
    );
    return result.rows.length > 0;
  }

  private saveCustomer(
    customer: LiriumRequestDto,
    girasolAccountId: string,
  ): void {
    this.databaseService.pool.query(
      'INSERT INTO users (user_id, girasol_account_id, status, label,' +
        'first_name, middle_name, last_name, date_of_birth, national_id_country, national_id_type, national_id,' +
        'citizenship, address_line1, address_line2, city, state, country, zip_code, tax_id, tax_country, cellphone, email, customer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,$22,$23)',
      [
        customer.id,
        girasolAccountId,
        customer.state,
        customer.profile.label,
        customer.profile.first_name,
        customer.profile.middle_name,
        customer.profile.last_name,
        customer.profile.date_of_birth,
        customer.profile.national_id_country,
        customer.profile.national_id_type,
        customer.profile.national_id,
        customer.profile.citizenship,
        customer.profile.address_line1,
        customer.profile.address_line2,
        customer.profile.city,
        customer.profile.state,
        customer.profile.country,
        customer.profile.zip_code,
        customer.profile.tax_id,
        customer.profile.tax_country,
        customer.contact.cellphone,
        customer.contact.email,
        customer.customer,
      ],
    );
  }

  private async saveWallet(
    wallets: AddWalletResponseDto,
    customerId: string,
  ): Promise<void> {
    for (const wallet of wallets.address) {
      await this.databaseService.pool.query(
        'INSERT INTO wallets (id, user_id, deposit_addr, network, currency, asset_type) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          this.generateWalletId(),
          customerId,
          wallet.address,
          wallet.network,
          wallet.currency,
          wallet.asset_type,
        ],
      );
    }
  }

  private generateWalletId(): string {
    return crypto.randomUUID();
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.mapLiriumError(error);

        // Solo reintentar si es un error que vale la pena reintentar
        if (this.shouldRetry(lastError) && attempt < maxRetries) {
          console.log(
            `❌ attempt ${attempt} failed, retrying in ${delay}ms...`,
            lastError.message,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          // No reintentar o último intento
          if (attempt === maxRetries) {
            console.log(
              `💥 All ${maxRetries} attempts failed, throwing final error:`,
              lastError,
            );
          }
          throw lastError;
        }
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: Error): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();

      if (status >= 500) {
        return true;
      }

      if (status === 408 || status === 429) {
        return true;
      }
      return false;
    }
    if (
      error.message.includes('ECONNABORTED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('timeout')
    ) {
      return true;
    }
    return false;
  }

  private mapLiriumError(error: any): Error {
    if (error?.error?.error_code) {
      const { error_code, error_msg, request_id } = error.error;
      const statusCode = error.status || 500;
      return new HttpException(
        {
          error_code,
          error_msg,
          request_id,
          source: 'lirium_api',
        },
        statusCode,
      );
    }
    return new HttpException(
      { message: error.message || 'Unknown error' },
      500,
    );
  }

  async createOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return this.retryOperation(async () => {
      const response = await this.httpService.post<any>(
        `${process.env.LIRIUM_API_URL}/customers/${order.customer_id}/orders`,
        order,
      );
      return response.data;
    });
  }

  async confirmOrder(
    order: LiriumOrderConfirmRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return this.retryOperation(async () => {
      const response = await this.httpService.post<LiriumOrderResponseDto>(
        `${process.env.LIRIUM_API_URL}/customers/${order.customer_id}/orders/${order.order_id}/confirm`,
        order,
      );
      return response.data;
    });
  }
}
