import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
    example: 'USDC'
  })
  currency: string;

  @ApiPropertyOptional({ 
    description: 'Amount of the asset',
    example: '100.50'
  })
  amount?: string;

  @ApiPropertyOptional({ 
    description: 'Settlement asset information',
    type: () => AssetDto
  })
  settlement?: AssetDto;

  @ApiPropertyOptional({ 
    description: 'Operation type',
    example: 'buy'
  })
  operation?: string;
}

export class CommissionDto {
  @ApiProperty({ 
    description: 'Commission type',
    example: 'percentage'
  })
  type: string;

  @ApiProperty({ 
    description: 'Commission value',
    example: '0.5'
  })
  value: string;
}

// TradeOperationDto can now reference AssetDto safely
export class TradeOperationDto {
  @ApiProperty({ 
    description: 'Settlement asset',
    type: () => AssetDto
  })
  settlement: AssetDto;

  @ApiProperty({ 
    description: 'Commission information',
    type: () => CommissionDto
  })
  commission: CommissionDto;

  @ApiPropertyOptional({ 
    description: 'Whether confirmation code is required',
    example: false
  })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({ 
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z'
  })
  expiresAt?: string;
}

export class SendOperationDto {
  @ApiProperty({ 
    description: 'Blockchain network',
    example: 'polygon'
  })
  network: string;

  @ApiProperty({ 
    description: 'Whether confirmation code is required',
    example: true
  })
  requiresConfirmationCode: boolean;

  @ApiProperty({ 
    description: 'Expiration timestamp',
    example: '2023-10-14T12:00:00Z'
  })
  expires_at: string;
}

export class DestinationDto {
  @ApiProperty({ 
    description: 'Destination type',
    example: 'crypto_currency_address'
  })
  type: string;

  @ApiProperty({ 
    description: 'Destination address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  })
  value: string;

  @ApiProperty({ 
    description: 'Amount to send',
    example: '50.25'
  })
  amount: string;
}

// OrderRequestDto goes LAST (after all dependencies are defined)
export class OrderRequestDto {
  @ApiProperty({ 
    description: 'Girasol User ID',
    example: 'user123' 
  })
  userId: string;
  @ApiProperty({ 
    description: 'Lirium Order ID',
    example: 'ord_123456' 
  })
  orderId?: string;
  @ApiProperty({ 
    description: 'Type of operation to perform',
    enum: OperationType,
    example: OperationType.BUY
  })
  operationType: OperationType;

  @ApiProperty({ 
    description: 'Asset information',
    type: () => AssetDto
  })
  asset: AssetDto;

  @ApiPropertyOptional({ 
    description: 'Trade operation details (for buy/sell)',
    type: () => TradeOperationDto
  })
  tradeOperation?: TradeOperationDto;

  @ApiPropertyOptional({ 
    description: 'Swap asset information',
    type: () => AssetDto
  })
  swap?: AssetDto;

  @ApiPropertyOptional({ 
    description: 'Send operation details',
    type: () => SendOperationDto
  })
  send?: SendOperationDto;

  @ApiPropertyOptional({ 
    description: 'Reference ID for the order',
    example: 'Buy20231014120000'
  })
  referenceId?: string;
}

export class OrderDto {
  id: string;
  asset: AssetDto;
  referenceId: string;
}

export class OrderResponseDto {
  @ApiProperty({ 
    description: 'Order ID',
    example: 'ord_123456'
  })
  orderId: string;

  @ApiProperty({ 
    description: 'Order status',
    example: 'pending'
  })
  status: string;

  @ApiProperty({ 
    description: 'Order creation date in ISO format',
    example: '2023-10-14T12:00:00Z'
  })
  createdAt: string;

  @ApiPropertyOptional({ 
    description: 'Whether confirmation code is required',
    example: false
  })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({ 
    description: 'Expiration date in ISO format',
    example: '2023-10-14T12:00:00Z'
  })
  expiresAt?: string;
}