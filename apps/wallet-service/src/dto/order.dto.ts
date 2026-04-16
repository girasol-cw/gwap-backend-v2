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

export enum OrderIdentifierType {
  LIRIUM_ID = 'lirium_id',
  REFERENCE_ID = 'reference_id',
}

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

export class OrderRequestDto {
  @ApiProperty({
    description: 'Legacy field for the Girasol account ID used to resolve the Lirium customer',
    example: 'user123',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Preferred field for the Girasol account ID used to resolve the Lirium customer',
    example: 'acc123',
  })
  accountId?: string;

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

export class OrderConfirmRequestDto {
  @ApiProperty({
    description: 'Legacy field for the Girasol account ID used to resolve the Lirium customer',
    example: 'user123',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Preferred field for the Girasol account ID used to resolve the Lirium customer',
    example: 'acc123',
  })
  accountId?: string;

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
  @ApiProperty({ type: () => AssetDto })
  from: AssetDto;

  @ApiProperty({ type: () => AssetDto })
  to: AssetDto;

  @ApiProperty({
    description: 'Raw bid rate used to estimate destination amount',
    example: '0.00002',
  })
  rate: string;
}
