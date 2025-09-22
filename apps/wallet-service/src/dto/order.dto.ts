export class OrderRequestDto {
  userId: string;
  amount: number;
  operationType: OperationType;
  buy?: BuyOperation;
  sell?: SellOperation;
  swap?: AssetDto;
  send?: SendOperation;
  referenceId?: string;
}

export class AssetDto {
  currency: string;
  amount?: string;
}

export abstract class Operation {
  settlement: AssetDto;
  commission: CommissionDto;
}

export class CommissionDto {
  type: string;
  value: string;
}

export class BuyOperation extends Operation {}

export class SellOperation extends Operation {}

export class SendOperation {
  network: string;
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
}
