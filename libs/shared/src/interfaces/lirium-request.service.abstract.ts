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
} from 'apps/wallet-service/src/dto/add-wallet.dto';

export abstract class LiriumRequestServiceAbstract {
  abstract createOrder(
    order: LiriumOrderRequestDto,
  ): Promise<LiriumOrderResponseDto>;
  abstract confirmOrder(
    order: LiriumOrderConfirmRequestDto,
  ): Promise<LiriumOrderResponseDto>;
  abstract getCustomerAccount(
    accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto>;
  abstract getWallets(accountId: string): Promise<AddWalletResponseDto>;
  abstract createCustomer(
    customer: AddWalletRequestDto,
    companyId: string,
  ): Promise<AddWalletResponseDto>;
  abstract getOrder(
    customerId: string,
    orderId: string,
  ): Promise<LiriumOrderResponseDto>;

  abstract resendOrderConfirmationCode(
    customerId: string,
    orderId: string,
  ): Promise<void>;
  abstract getExchangeRates(): Promise<LiriumExchangeRatesResponseDto>;
}
