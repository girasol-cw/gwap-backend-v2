import { AddWalletResponseDto } from "apps/wallet-service/src/dto/add-wallet.dto";
import { LiriumOrderRequestDto } from "apps/deposit/src/dto/lirium.dto";
import { LiriumOrderResponseDto } from "apps/deposit/src/dto/lirium.dto";
import { LiriumOrderConfirmRequestDto } from "apps/deposit/src/dto/lirium.dto";
import { LiriumCustomerAccountResponseDto } from "apps/deposit/src/dto/lirium.dto";
import { AddWalletRequestDto } from "apps/wallet-service/src/dto/add-wallet.dto";

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
    ): Promise<AddWalletResponseDto>;
  }