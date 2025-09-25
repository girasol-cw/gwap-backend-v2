import { Injectable } from '@nestjs/common';
import {
  LiriumOrderRequestDto,
  LiriumOrderResponseDto,
} from 'apps/deposit/src/dto/lirium.dto';
import { LiriumCustomerAccountResponseDto } from 'apps/deposit/src/dto/lirium.dto';
import {
  AddWalletRequestDto,
  AddWalletResponseDto,
} from 'apps/wallet-service/src/dto/add-wallet.dto';
import { HttpWrapperService } from './http-wrapper.service';

export abstract class LiriumRequestServiceAbstract {
  abstract createOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto>;
  abstract confirmOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto>;
  abstract getCustomerAccount(
    accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto>;
  abstract getWallets(accountId: string): Promise<AddWalletResponseDto>;
  abstract createCustomer(
    customer: AddWalletRequestDto,
  ): Promise<AddWalletResponseDto>;
}

@Injectable()
export class LiriumRequestService extends LiriumRequestServiceAbstract {
  constructor(private readonly httpService: HttpWrapperService) {
    super();
  }

  async getCustomerAccount(
    accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto> {
    //todo: have to look for userCostumerId in the BD, so, is missing the service to get the userCostumerId from the BD
    const id = accountId;
    const response =
      await this.httpService.get<LiriumCustomerAccountResponseDto>(
        `${process.env.LIRIUM_API_URL}/customers/${accountId}/accounts`,
      );
    return response.data;
  }
  async getWallets(accountId: string): Promise<AddWalletResponseDto> {
    const response = await this.httpService.get<AddWalletResponseDto>(
      `${process.env.LIRIUM_API_URL}/customers/${accountId}/receiving_addresses`,
    );
    return response.data;
  }
  async createCustomer(
    customer: AddWalletRequestDto,
  ): Promise<AddWalletResponseDto> {
    const response = await this.httpService.post<AddWalletResponseDto>(
      `${process.env.LIRIUM_API_URL}/customers`,
      customer,
    );
    return response.data;
  }
  async createOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    const response = await this.httpService.post<LiriumOrderResponseDto>(
      `${process.env.LIRIUM_API_URL}/customers/{customer_id}/orders`,
      order,
    );
    return response.data;
  }
  async confirmOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    const response = await this.httpService.post<LiriumOrderResponseDto>(
      `${process.env.LIRIUM_API_URL}/customers/{customer_id}/orders/{order_id}/confirm`,
      order,
    );
    return response.data;
  }
}
