import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import {
  LiriumCustomerAccountResponseDto,
  LiriumExchangeRatesResponseDto,
  LiriumOrderConfirmRequestDto,
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from 'apps/wallet-service/src/dto/lirium.dto';

import {
  AddWalletRequestDto,
  AddWalletResponseDto,
  WalletProvisionStatus,
  walletDto,
} from 'apps/wallet-service/src/dto/add-wallet.dto';
import { HttpWrapperService } from './http-wrapper.service';
import { LiriumRequestDto } from '../dto/lirium-request.dto';
import { DatabaseService } from './database.service';
import { LiriumRequestServiceAbstract } from '../interfaces/lirium-request.service.abstract';

type PersistedCustomerRecord = {
  user_id: string;
  company_id: string;
  girasol_account_id: string;
  status: WalletProvisionStatus | null;
  label: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  national_id_country: string;
  national_id_type: string;
  national_id: string;
  citizenship: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  country: string;
  zip_code: string;
  tax_id: string | null;
  tax_country: string | null;
  cellphone: string;
  email: string;
  customer: LiriumRequestDto | null;
};

type RequestLogCustomerRecord = {
  response_body: LiriumRequestDto | null;
};

@Injectable()
export class LiriumRequestService extends LiriumRequestServiceAbstract {
  private readonly logger = new Logger(LiriumRequestService.name);

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
  async getWallets(customerId: string): Promise<AddWalletResponseDto> {
    const response = await this.httpService.get<any>(
      `${process.env.LIRIUM_API_URL}/customers/${customerId}/receiving_addresses`,
    );
    const responseDto = new AddWalletResponseDto();
    responseDto.address = this.normalizeReceivingAddresses(response.data);

    if (responseDto.address.length === 0) {
      return responseDto;
    }
    return responseDto;
  }

  async createCustomer(
    customer: AddWalletRequestDto,
    companyId: string,
  ): Promise<AddWalletResponseDto> {
    const requestBody = this.buildCustomerRequest(customer);
    const existingCustomer = await this.findLocalCustomer(customer.accountId, companyId);

    if (existingCustomer) {
      return this.resumeExistingCustomer(existingCustomer, customer, requestBody, companyId);
    }

    const relinkedCustomer = await this.findCustomerFromRequestLog(requestBody.reference_id);
    if (relinkedCustomer?.id) {
      const updatedRemoteCustomer = await this.syncRemoteCustomer(
        relinkedCustomer.id,
        requestBody,
      );
      await this.saveCustomer(updatedRemoteCustomer, customer, companyId, 'pending_wallet_sync');
      return this.syncWalletsForCustomer(customer, companyId, updatedRemoteCustomer.id!);
    }

    const remoteCustomer = await this.createRemoteCustomer(requestBody);
    await this.saveCustomer(remoteCustomer, customer, companyId, 'pending_wallet_sync');
    return this.syncWalletsForCustomer(customer, companyId, remoteCustomer.id!);
  }

  private async saveCustomer(
    customer: LiriumRequestDto,
    request: AddWalletRequestDto,
    companyId: string,
    status: WalletProvisionStatus,
  ): Promise<void> {
    const normalizedRequest = this.getNormalizedCustomerFields(request);

    await this.databaseService.pool.query(
      'INSERT INTO users (user_id, company_id, girasol_account_id, status, label,' +
      'first_name, middle_name, last_name, date_of_birth, national_id_country, national_id_type, national_id,' +
      'citizenship, address_line1, address_line2, city, state, country, zip_code, tax_id, tax_country, cellphone, email, customer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)',
      [
        customer.id ?? '',
        companyId,
        request.accountId,
        status,
        normalizedRequest.label,
        request.firstName,
        normalizedRequest.middleName,
        request.lastName,
        request.birthDate,
        request.nationalIdCountryIso2,
        'national_id',
        request.nationalId,
        request.citizenshipIso2,
        request.addressLine1,
        normalizedRequest.addressLine2,
        request.city,
        request.state,
        request.countryIso2,
        request.zipCode,
        normalizedRequest.taxId,
        normalizedRequest.taxCountryIso2,
        request.cellphone,
        request.email,
        customer.customer ?? JSON.stringify(customer),
      ],
    );
  }

  private async saveWallet(
    wallets: AddWalletResponseDto,
    customerId: string,
    companyId: string,
  ): Promise<void> {
    if (!wallets.address?.length) {
      return;
    }

    for (const wallet of wallets.address) {
      const existingWallet = await this.databaseService.pool.query<{ id: string }>(
        'SELECT id FROM wallets WHERE company_id = $1 AND user_id = $2 AND deposit_addr = $3 AND network = $4 LIMIT 1',
        [companyId, customerId, wallet.address, wallet.network],
      );

      if (existingWallet.rows.length > 0) {
        continue;
      }

      await this.databaseService.pool.query(
        'INSERT INTO wallets (id, company_id, user_id, deposit_addr, network, currency, asset_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          this.generateWalletId(),
          companyId,
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

  private async resumeExistingCustomer(
    existingCustomer: PersistedCustomerRecord,
    request: AddWalletRequestDto,
    requestBody: LiriumRequestDto,
    companyId: string,
  ): Promise<AddWalletResponseDto> {
    if (this.hasCustomerChanges(existingCustomer, request)) {
      const updatedRemoteCustomer = await this.syncRemoteCustomer(
        existingCustomer.user_id,
        requestBody,
      );
      await this.updateCustomerRecord(
        existingCustomer.user_id,
        request,
        companyId,
        existingCustomer.status ?? 'pending_wallet_sync',
        updatedRemoteCustomer,
      );
    }

    return this.syncWalletsForCustomer(request, companyId, existingCustomer.user_id);
  }

  private buildCustomerRequest(customer: AddWalletRequestDto): LiriumRequestDto {
    const normalizedRequest = this.getNormalizedCustomerFields(customer);

    return {
      type: customer.userType,
      reference_id: this.buildCustomerReferenceId(customer),
      profile: {
        label: normalizedRequest.label ?? undefined,
        first_name: customer.firstName,
        middle_name: normalizedRequest.middleName ?? undefined,
        last_name: customer.lastName,
        date_of_birth: customer.birthDate,
        national_id_country: customer.nationalIdCountryIso2,
        national_id_type: 'national_id',
        national_id: customer.nationalId,
        citizenship: customer.citizenshipIso2,
        address_line1: customer.addressLine1,
        address_line2: normalizedRequest.addressLine2 ?? undefined,
        city: customer.city,
        state: customer.state,
        country: customer.countryIso2,
        zip_code: customer.zipCode,
        tax_id: normalizedRequest.taxId ?? undefined,
        tax_country: normalizedRequest.taxCountryIso2 ?? undefined,
        cellphone: customer.cellphone,
        name: normalizedRequest.name ?? undefined,
      },
      contact: {
        email: customer.email,
        cellphone: customer.cellphone,
      },
    };
  }

  private buildCustomerReferenceId(customer: AddWalletRequestDto): string {
    return customer.accountId;
  }

  private async createRemoteCustomer(requestBody: LiriumRequestDto): Promise<LiriumRequestDto> {
    const response = await this.httpService.post<any>(
      `${process.env.LIRIUM_API_URL}/customers`,
      requestBody,
    );

    return this.attachSerializedCustomer(response.data as LiriumRequestDto);
  }

  private async syncRemoteCustomer(
    customerId: string,
    requestBody: LiriumRequestDto,
  ): Promise<LiriumRequestDto> {
    try {
      const response = await this.httpService.put<any>(
        `${process.env.LIRIUM_API_URL}/customers/${customerId}`,
        requestBody,
      );
      return this.attachSerializedCustomer(response.data as LiriumRequestDto, customerId);
    } catch (error) {
      if (error instanceof HttpException && [404, 405, 501].includes(error.getStatus())) {
        this.logger.warn(
          `PUT /customers/${customerId} returned ${error.getStatus()}, retrying with PATCH`,
        );
        const response = await this.httpService.patch<any>(
          `${process.env.LIRIUM_API_URL}/customers/${customerId}`,
          requestBody,
        );
        return this.attachSerializedCustomer(response.data as LiriumRequestDto, customerId);
      }

      throw error;
    }
  }

  private attachSerializedCustomer(
    customer: LiriumRequestDto,
    fallbackId?: string,
  ): LiriumRequestDto {
    const normalizedCustomer = {
      ...customer,
      id: customer.id ?? fallbackId,
    };

    normalizedCustomer.customer = JSON.stringify(normalizedCustomer);
    return normalizedCustomer;
  }

  private async syncWalletsForCustomer(
    request: AddWalletRequestDto,
    companyId: string,
    customerId: string,
  ): Promise<AddWalletResponseDto> {
    const responseDto = this.buildAddWalletResponse(customerId, request.email);

    try {
      const wallets = await this.getWallets(customerId);
      responseDto.address = wallets.address ?? [];
      await this.saveWallet(wallets, customerId, companyId);

      const persistedWallets = await this.getPersistedWallets(customerId, companyId);
      if (responseDto.address.length === 0) {
        responseDto.address = persistedWallets;
      }

      const nextStatus: WalletProvisionStatus =
        persistedWallets.length > 0 ? 'ready' : 'pending_wallet_sync';
      await this.updateUserStatus(customerId, companyId, nextStatus);
      responseDto.provisionStatus = nextStatus;
      return responseDto;
    } catch (error) {
      await this.updateUserStatus(customerId, companyId, 'wallet_sync_failed');
      responseDto.provisionStatus = 'wallet_sync_failed';
      responseDto.address = await this.getPersistedWallets(customerId, companyId);
      return responseDto;
    }
  }

  private buildAddWalletResponse(
    customerId: string,
    email: string,
  ): AddWalletResponseDto {
    const responseDto = new AddWalletResponseDto();
    responseDto.accountId = customerId;
    responseDto.userId = customerId;
    responseDto.email = email;
    responseDto.address = [];
    return responseDto;
  }

  private async findLocalCustomer(
    accountId: string,
    companyId: string,
  ): Promise<PersistedCustomerRecord | null> {
    const result = await this.databaseService.pool.query<PersistedCustomerRecord>(
      'SELECT user_id, company_id, girasol_account_id, status, label, first_name, middle_name, last_name, date_of_birth, national_id_country, national_id_type, national_id, citizenship, address_line1, address_line2, city, state, country, zip_code, tax_id, tax_country, cellphone, email, customer FROM users WHERE girasol_account_id = $1 AND company_id = $2 LIMIT 1',
      [accountId, companyId],
    );

    return result.rows[0] ?? null;
  }

  private async findCustomerFromRequestLog(
    referenceId: string,
  ): Promise<LiriumRequestDto | null> {
    const result = await this.databaseService.pool.query<RequestLogCustomerRecord>(
      `SELECT response_body
         FROM requests
        WHERE verb = 'POST'
          AND path = $1
          AND status_code LIKE '2%%'
          AND body->>'reference_id' = $2
        ORDER BY created_at DESC
        LIMIT 1`,
      [`${process.env.LIRIUM_API_URL}/customers`, referenceId],
    );

    return result.rows[0]?.response_body ?? null;
  }

  private hasCustomerChanges(
    existingCustomer: PersistedCustomerRecord,
    request: AddWalletRequestDto,
  ): boolean {
    const normalizedRequest = this.getNormalizedCustomerFields(request);
    const normalizedExistingCustomer = {
      label: this.normalizeOptionalString(existingCustomer.label),
      middleName: this.normalizeOptionalString(existingCustomer.middle_name),
      addressLine2: this.normalizeOptionalString(existingCustomer.address_line2),
      taxId: this.normalizeOptionalString(existingCustomer.tax_id),
      taxCountryIso2: this.normalizeOptionalString(existingCustomer.tax_country),
    };
    const persistedRemoteCustomer = existingCustomer.customer as Record<string, unknown> | null;

    return (
      (persistedRemoteCustomer?.type as string | undefined) !== request.userType ||
      normalizedExistingCustomer.label !== normalizedRequest.label ||
      existingCustomer.first_name !== request.firstName ||
      normalizedExistingCustomer.middleName !== normalizedRequest.middleName ||
      existingCustomer.last_name !== request.lastName ||
      existingCustomer.date_of_birth !== request.birthDate ||
      existingCustomer.national_id_country !== request.nationalIdCountryIso2 ||
      existingCustomer.national_id_type !== 'national_id' ||
      existingCustomer.national_id !== request.nationalId ||
      existingCustomer.citizenship !== request.citizenshipIso2 ||
      existingCustomer.address_line1 !== request.addressLine1 ||
      normalizedExistingCustomer.addressLine2 !== normalizedRequest.addressLine2 ||
      existingCustomer.city !== request.city ||
      existingCustomer.state !== request.state ||
      existingCustomer.country !== request.countryIso2 ||
      existingCustomer.zip_code !== request.zipCode ||
      normalizedExistingCustomer.taxId !== normalizedRequest.taxId ||
      normalizedExistingCustomer.taxCountryIso2 !== normalizedRequest.taxCountryIso2 ||
      existingCustomer.cellphone !== request.cellphone ||
      existingCustomer.email !== request.email
    );
  }

  private async updateCustomerRecord(
    customerId: string,
    request: AddWalletRequestDto,
    companyId: string,
    status: WalletProvisionStatus,
    remoteCustomer: LiriumRequestDto,
  ): Promise<void> {
    const normalizedRequest = this.getNormalizedCustomerFields(request);

    await this.databaseService.pool.query(
      `UPDATE users
          SET status = $1,
              label = $2,
              first_name = $3,
              middle_name = $4,
              last_name = $5,
              date_of_birth = $6,
              national_id_country = $7,
              national_id_type = $8,
              national_id = $9,
              citizenship = $10,
              address_line1 = $11,
              address_line2 = $12,
              city = $13,
              state = $14,
              country = $15,
              zip_code = $16,
              tax_id = $17,
              tax_country = $18,
              cellphone = $19,
              email = $20,
              customer = $21
        WHERE user_id = $22
          AND company_id = $23`,
      [
        status,
        normalizedRequest.label,
        request.firstName,
        normalizedRequest.middleName,
        request.lastName,
        request.birthDate,
        request.nationalIdCountryIso2,
        'national_id',
        request.nationalId,
        request.citizenshipIso2,
        request.addressLine1,
        normalizedRequest.addressLine2,
        request.city,
        request.state,
        request.countryIso2,
        request.zipCode,
        normalizedRequest.taxId,
        normalizedRequest.taxCountryIso2,
        request.cellphone,
        request.email,
        remoteCustomer.customer ?? JSON.stringify(remoteCustomer),
        customerId,
        companyId,
      ],
    );
  }

  private async updateUserStatus(
    customerId: string,
    companyId: string,
    status: WalletProvisionStatus,
  ): Promise<void> {
    await this.databaseService.pool.query(
      'UPDATE users SET status = $1 WHERE user_id = $2 AND company_id = $3',
      [status, customerId, companyId],
    );
  }

  private async getPersistedWallets(
    customerId: string,
    companyId: string,
  ): Promise<walletDto[]> {
    const result = await this.databaseService.pool.query<walletDto>(
      `SELECT deposit_addr AS address,
              network,
              currency,
              asset_type
         FROM wallets
        WHERE user_id = $1
          AND company_id = $2`,
      [customerId, companyId],
    );

    return result.rows;
  }

  private normalizeReceivingAddresses(payload: unknown): walletDto[] {
    const rawAddresses = this.extractReceivingAddresses(payload);

    if (!Array.isArray(rawAddresses)) {
      this.logger.warn(
        `Unexpected receiving addresses response shape: ${JSON.stringify(
          this.summarizeReceivingAddressesPayload(payload),
        )}`,
      );
      return [];
    }

    return rawAddresses
      .map((wallet: unknown) => this.mapWalletAddress(wallet))
      .filter((wallet): wallet is walletDto => wallet !== null);
  }

  private extractReceivingAddresses(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const candidate = payload as Record<string, unknown>;

    return candidate.receiving_addresses ??
      (candidate.data && typeof candidate.data === 'object'
        ? (candidate.data as Record<string, unknown>).receiving_addresses
        : undefined);
  }

  private mapWalletAddress(wallet: unknown): walletDto | null {
    if (!wallet || typeof wallet !== 'object') {
      return null;
    }

    const candidate = wallet as Record<string, unknown>;
    const address = this.pickFirstString(candidate.address, candidate.value);
    const network = this.pickFirstString(candidate.network, candidate.blockchain);
    const currency = this.pickFirstString(candidate.currency, candidate.asset, candidate.code);
    const assetType = this.pickFirstString(candidate.asset_type, candidate.type);

    if (!address || !network || !currency || !assetType) {
      return null;
    }

    return {
      address,
      network,
      currency,
      asset_type: assetType,
    };
  }

  private summarizeReceivingAddressesPayload(payload: unknown): Record<string, unknown> {
    if (Array.isArray(payload)) {
      return {
        type: 'array',
        length: payload.length,
      };
    }

    if (payload && typeof payload === 'object') {
      const candidate = payload as Record<string, unknown>;

      return {
        type: 'object',
        keys: Object.keys(candidate).slice(0, 10),
        receivingAddressesType: this.describePayloadType(candidate.receiving_addresses),
        dataType: this.describePayloadType(candidate.data),
      };
    }

    return {
      type: this.describePayloadType(payload),
      value: payload ?? null,
    };
  }

  private pickFirstString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private describePayloadType(value: unknown): string {
    if (Array.isArray(value)) {
      return 'array';
    }

    if (value === null) {
      return 'null';
    }

    return typeof value;
  }

  private getNormalizedCustomerFields(request: AddWalletRequestDto): {
    label: string | null;
    middleName: string | null;
    addressLine2: string | null;
    taxId: string | null;
    taxCountryIso2: string | null;
    name: string | null;
  } {
    return {
      label: this.normalizeOptionalString(request.label),
      middleName: this.normalizeOptionalString(request.middleName),
      addressLine2: this.normalizeOptionalString(request.addressLine2),
      taxId: this.normalizeOptionalString(request.taxId),
      taxCountryIso2: this.normalizeOptionalString(request.taxCountryIso2),
      name: this.normalizeOptionalString(request.name),
    };
  }

  private normalizeOptionalString(value?: string | null): string | null {
    if (value == null) {
      return null;
    }

    return value.trim().length > 0 ? value : null;
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
          this.logger.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms: ${lastError.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          // No reintentar o último intento
          if (attempt === maxRetries) {
            this.logger.error(
              `All ${maxRetries} attempts failed, throwing final error: ${lastError.message}`,
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
    if (error instanceof HttpException) {
      return error;
    }

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

  async getOrder(
    customerId: string,
    orderId: string,
  ): Promise<LiriumOrderResponseDto> {
    return this.retryOperation(async () => {
      const response = await this.httpService.get<LiriumOrderResponseDto>(
        `${process.env.LIRIUM_API_URL}/customers/${customerId}/orders/${orderId}`,
      );
      return response.data;
    });
  }

  async resendOrderConfirmationCode(
    customerId: string,
    orderId: string,
  ): Promise<void> {
    await this.retryOperation(async () => {
      await this.httpService.post(
        `${process.env.LIRIUM_API_URL}/customers/${customerId}/orders/${orderId}/resend_code`,
        {},
      );
    });
  }

  async getExchangeRates(): Promise<LiriumExchangeRatesResponseDto> {
    return this.retryOperation(async () => {
      const response = await this.httpService.get<LiriumExchangeRatesResponseDto>(
        `${process.env.LIRIUM_API_URL}/exchange_rates`,
      );
      return response.data;
    });
  }
}
