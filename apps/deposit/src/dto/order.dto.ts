export class OrderRequestDto {
  userId: string;
  operationType: OperationType;
  asset: AssetDto;
  tradeOperation?: TradeOperationDto;
  swap?: AssetDto;
  send?: SendOperationDto;
  referenceId?: string;
}

export class AssetDto {
  currency: string;
  amount?: string;
  settlement?: AssetDto;
  operation?: string;
}

export class TradeOperationDto {
  settlement: AssetDto;
  commission: CommissionDto;
  requiresConfirmationCode?: boolean;
  expiresAt?: string;
}

export class CommissionDto {
  type: string;
  value: string;
}

export class SendOperationDto {
  network: string;
  requiresConfirmationCode: boolean;
  expires_at: string;
}
export class DestinationDto {
  type: string; //crypto_currency_address
  value: string; //address
  amount: string;
}

export enum OperationType {
  BUY = 'buy',
  SELL = 'sell',
  SWAP = 'swap',
  SEND = 'send',
  SUBSCRIBE_INVESTMENT = 'subscribe_investment',
  REDEEM_INVESTMENT = 'redeem_investment',
}

export class OrderResponseDto {
  orderId: string;
  status: string;
  createdAt: string;
  requiresConfirmationCode?: boolean;
  expiresAt?: string;
}
