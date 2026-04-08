import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
export enum OperationType {
  BUY = 'buy',
  SELL = 'sell',
  SWAP = 'swap',
  SEND = 'send',
  SUBSCRIBE_INVESTMENT = 'subscribe_investment',
  REDEEM_INVESTMENT = 'redeem_investment',
}

// Define AssetDto FIRST (before any class that uses it)
export class AssetDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'USDC',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Amount of the asset',
    example: '100.50',
  })
  amount?: string;

  @ApiPropertyOptional({
    description: 'Settlement asset information',
    type: () => AssetDto,
  })
  settlement?: AssetDto;

  @ApiPropertyOptional({
    description: 'Operation type',
    example: 'buy',
  })
  operation?: string;
  @Transform(({ value }) => ({ requires_confirmation_code: value }), {
    toPlainOnly: true,
  })
  requiresConfirmationCode?: boolean;
}

export class CommissionDto {
  @ApiProperty({
    description: 'Commission type',
    example: 'percentage',
  })
  type: string;

  @ApiProperty({
    description: 'Commission value',
    example: '0.5',
  })
  value: string;
}

// TradeOperationDto can now reference AssetDto safely
export class TradeOperationDto {
  @ApiProperty({
    description: 'Settlement asset',
    type: () => AssetDto,
  })
  settlement: AssetDto;

  @ApiProperty({
    description: 'Commission information',
    type: () => CommissionDto,
  })
  commission: CommissionDto;

  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;
}
export class SwapOperationDto {
  @ApiProperty({
    description: 'Destination currency for the swap',
    example: 'BTC',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Amount to swap (optional depending on flow)',
    example: '100.00',
  })
  amount?: string;

  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;
}
export class DestinationDto {
  @ApiProperty({
    description: 'Destination type',
    example: 'crypto_currency_address',
  })
  type: string;

  @ApiProperty({
    description: 'Destination address or customer id',
    example: '0xaddress',
  })
  value: string;

  @ApiPropertyOptional({
    description: 'Amount to arrive at destination',
    example: '50.25',
  })
  amount?: string;
}
export class SendOperationDto {
  @ApiProperty({
    description: 'Blockchain network',
    example: 'polygon',
  })
  network: string;

  @ApiProperty({
    description: 'Destination details',
    type: () => DestinationDto,
  })
  destination: DestinationDto;

  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;
}



// NOTE:
// Only ONE operation node must be provided:
// - tradeOperation (buy/sell)
// - swap
// - send
// These are mutually exclusive as per Lirium API contract.
export class OrderRequestDto {
  @ApiProperty({
    description: 'Girasol User ID',
    example: 'user123',
  })
  userId: string;
  @ApiPropertyOptional({
    description: 'Lirium Order ID',
    example: 'ord_123456',
  })
  orderId?: string;
  @ApiProperty({
    description: 'Type of operation to perform',
    enum: OperationType,
    example: OperationType.BUY,
  })
  operationType: OperationType;

  @ApiProperty({
    description: 'Source asset (asset to spend)',
    type: () => AssetDto,
  })
  asset: AssetDto;

  @ApiPropertyOptional({
    description: 'Trade operation details (for buy/sell)',
    type: () => TradeOperationDto,
  })
  tradeOperation?: TradeOperationDto;

  @ApiPropertyOptional({
    description: 'Swap operation details',
    type: () => SwapOperationDto,
  })
  swap?: SwapOperationDto;

  @ApiPropertyOptional({
    description: 'Send operation details',
    type: () => SendOperationDto,
  })
  send?: SendOperationDto;

  @ApiPropertyOptional({
    description: 'Reference ID for the order',
    example: 'Buy20231014120000',
  })
  referenceId?: string;
}

export class OrderDto {
  id: string;
  asset: AssetDto;
  referenceId: string;
}

export class OrderResponseDto {
  orderId: string;
  status: string;
  createdAt: string;
  requiresConfirmationCode?: boolean;
  expiresAt?: string;
}


export class OrderConfirmRequestDto {
  @ApiProperty({
    description: 'Girasol User ID',
    example: 'user123',
  })
  userId: string;
  @ApiPropertyOptional({
    description: 'Lirium Order ID',
    example: 'ord_123456',
  })
  orderId?: string;
  @ApiPropertyOptional({
    description: 'Confirmation code',
    example: '123456',
  })
  confirmationCode?: string;
}

export class WithdrawRequestDto {
  @ApiProperty({ example: 'user123' })
  userId: string;

  @ApiProperty({ example: 'USDC' })
  currency: string;

  @ApiProperty({ example: '10.00' })
  assetAmount?: string;

  @ApiProperty({ example: 'polygon' })
  network: string;

  @ApiProperty({ type: () => DestinationDto })
  destination: DestinationDto;

  @ApiPropertyOptional({ example: 'withdraw-123' })
  referenceId?: string;
}

export class ConfirmWithdrawRequestDto {
  @ApiProperty({ example: 'user123' })
  userId: string;

  @ApiPropertyOptional({ example: '123456' })
  confirmationCode?: string;
}

export class WithdrawResponseDto {
  @ApiProperty({ example: 'ord_123' })
  withdrawId: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ example: false })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({ example: '2026-04-08T14:00:00Z' })
  expiresAt?: string;

  @ApiProperty({ type: () => AssetDto })
  asset: AssetDto;
}

export class WithdrawStateResponseDto {
  @ApiProperty({ example: 'ord_123' })
  withdrawId: string;

  @ApiProperty({ example: 'send' })
  operation: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ type: () => AssetDto })
  asset: AssetDto;

  @ApiPropertyOptional({ example: 'polygon' })
  network?: string;

  @ApiPropertyOptional({ example: 'crypto_currency_address' })
  destinationType?: string;

  @ApiPropertyOptional({ example: '0xabc...' })
  destinationValue?: string;

  @ApiPropertyOptional({ example: '10.00' })
  destinationAmount?: string;

  @ApiPropertyOptional({ example: '0.50' })
  fees?: string;

  @ApiPropertyOptional({ example: false })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({ example: '2026-04-08T14:00:00Z' })
  expiresAt?: string;

  @ApiPropertyOptional({ example: '0xhash...' })
  transactionId?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:00:00Z' })
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:05:00Z' })
  submittedAt?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:06:00Z' })
  lastUpdatedAt?: string;
}

export class SwapQuoteRequestDto {
  @ApiProperty({
    description: 'Source asset (asset to swap from)',
    type: () => AssetDto,
  })
  asset: AssetDto;

  @ApiProperty({
    description: 'Destination currency',
    example: 'BTC',
  })
  toCurrency: string;
}

export class SwapQuoteResponseDto {
  @ApiProperty({
    description: 'Source asset',
    type: () => AssetDto,
  })
  from: AssetDto;

  @ApiProperty({
    description: 'Estimated destination asset',
    type: () => AssetDto,
  })
  to: AssetDto;

  @ApiPropertyOptional({
    description: 'Estimated rate',
    example: '0.00002',
  })
  rate?: string;

  @ApiPropertyOptional({
    description: 'Estimated fees',
    example: '0.25',
  })
  fees?: string;

  @ApiPropertyOptional({
    description: 'Expiration date of quote',
    example: '2026-04-08T14:00:00Z',
  })
  expiresAt?: string;
}