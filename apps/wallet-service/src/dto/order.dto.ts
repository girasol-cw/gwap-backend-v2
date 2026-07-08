import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

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
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USDC',
  })
  currency: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Amount of the asset',
    example: '100.50',
  })
  amount?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssetDto)
  @ApiPropertyOptional({
    description: 'Settlement asset information',
    type: () => AssetDto,
  })
  settlement?: AssetDto;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Operation type',
    example: 'buy',
  })
  operation?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => ({ requires_confirmation_code: value }), {
    toPlainOnly: true,
  })
  requiresConfirmationCode?: boolean;
}

export class CommissionDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Commission type',
    example: 'percentage',
  })
  type?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Commission value',
    example: '0.5',
  })
  value?: string;
}

export class TradeOperationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetDto)
  @ApiPropertyOptional({
    description: 'Settlement asset',
    type: () => AssetDto,
  })
  settlement?: AssetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionDto)
  @ApiPropertyOptional({
    description: 'Commission information',
    type: () => CommissionDto,
  })
  commission?: CommissionDto;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;
}

export class SwapOperationDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Destination currency for the swap',
    example: 'BTC',
  })
  currency?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Amount to swap (optional depending on flow)',
    example: '100.00',
  })
  amount?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;
}

export class DestinationDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Destination type',
    example: 'crypto_currency_address',
  })
  type?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Destination address or customer id',
    example: '0xaddress',
  })
  value?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Amount to arrive at destination',
    example: '50.25',
  })
  amount?: string;
}

export class SendOperationDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Blockchain network',
    example: 'polygon',
  })
  network?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DestinationDto)
  @ApiPropertyOptional({
    description: 'Destination details',
    type: () => DestinationDto,
  })
  destination?: DestinationDto;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z',
  })
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether confirmation code is required',
    example: false,
  })
  requiresConfirmationCode?: boolean;
}

export class OrderRequestDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Girasol account ID used to resolve the Lirium customer',
    example: 'acc123',
  })
  accountId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Lirium Order ID',
    example: 'ord_123456',
  })
  orderId?: string;

  @IsOptional()
  @IsEnum(OperationType)
  @ApiPropertyOptional({
    description: 'Legacy internal field for the operation type. Prefer operation.',
    enum: OperationType,
    example: OperationType.BUY,
  })
  operationType?: OperationType;

  @IsOptional()
  @IsEnum(OperationType)
  @ApiPropertyOptional({
    description: 'Lirium operation type',
    enum: OperationType,
    example: OperationType.SEND,
  })
  operation?: OperationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssetDto)
  @ApiPropertyOptional({
    description: 'Source asset (asset to spend)',
    type: () => AssetDto,
  })
  asset?: AssetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TradeOperationDto)
  @ApiPropertyOptional({
    description: 'Legacy trade operation details (for buy/sell)',
    type: () => TradeOperationDto,
  })
  tradeOperation?: TradeOperationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TradeOperationDto)
  @ApiPropertyOptional({
    description: 'Lirium buy payload',
    type: () => TradeOperationDto,
  })
  buy?: TradeOperationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TradeOperationDto)
  @ApiPropertyOptional({
    description: 'Lirium sell payload',
    type: () => TradeOperationDto,
  })
  sell?: TradeOperationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SwapOperationDto)
  @ApiPropertyOptional({
    description: 'Swap operation details',
    type: () => SwapOperationDto,
  })
  swap?: SwapOperationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendOperationDto)
  @ApiPropertyOptional({
    description: 'Send operation details',
    type: () => SendOperationDto,
  })
  send?: SendOperationDto;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Legacy reference ID for the order',
    example: 'Buy20231014120000',
  })
  referenceId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Lirium reference_id for the order',
    example: 'REF1',
  })
  reference_id?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Preferred Lirium customer id. If provided, accountId lookup is skipped.',
    example: '15ae3bc6efdd47699b26dc9c20812ab7',
  })
  customerId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Lirium customer_id. If provided, accountId lookup is skipped.',
    example: '15ae3bc6efdd47699b26dc9c20812ab7',
  })
  customer_id?: string;
}

export class OrderConfirmRequestDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Girasol account ID used to resolve the Lirium customer',
    example: 'acc123',
  })
  accountId: string;

  @ApiPropertyOptional({
    description: 'Lirium Order ID',
    example: 'ord_123456',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Confirmation code',
    example: '123456',
  })
  confirmationCode?: string;
}

export class SwapQuoteRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => AssetDto)
  @ApiProperty({
    description: 'Source asset (asset to swap from)',
    type: () => AssetDto,
  })
  asset: AssetDto;

  @IsDefined()
  @IsString()
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
