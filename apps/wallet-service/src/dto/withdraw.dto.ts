import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDestinationDto {
  @ApiProperty({ example: 'crypto_currency_address' })
  type: string;

  @ApiProperty({ example: '0xabc123...' })
  value: string;

  @ApiPropertyOptional({ example: '10.00' })
  amount?: string;
}

export class WithdrawRequestDto {
  @ApiProperty({ example: 'USDC' })
  currency: string;

  @ApiPropertyOptional({ example: '10.00' })
  assetAmount?: string;

  @ApiProperty({ example: 'polygon' })
  network: string;

  @ApiProperty({ type: () => WithdrawDestinationDto })
  destination: WithdrawDestinationDto;

  @ApiPropertyOptional({ example: 'withdraw-123' })
  referenceId?: string;
}

export class ConfirmWithdrawRequestDto {
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
}

export class WithdrawStateResponseDto {
  @ApiProperty({ example: 'ord_123' })
  withdrawId: string;

  @ApiProperty({ example: 'send' })
  operation: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: 'USDC' })
  currency: string;

  @ApiPropertyOptional({ example: '10.00' })
  assetAmount?: string;

  @ApiPropertyOptional({ example: 'polygon' })
  network?: string;

  @ApiPropertyOptional({ example: 'crypto_currency_address' })
  destinationType?: string;

  @ApiPropertyOptional({ example: '0xabc123...' })
  destinationValue?: string;

  @ApiPropertyOptional({ example: '10.00' })
  destinationAmount?: string;

  @ApiPropertyOptional({ example: '0.25' })
  fees?: string;

  @ApiPropertyOptional({ example: false })
  requiresConfirmationCode?: boolean;

  @ApiPropertyOptional({ example: '2026-04-08T14:00:00Z' })
  expiresAt?: string;

  @ApiPropertyOptional({ example: '0xtxhash...' })
  transactionId?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:00:00Z' })
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:05:00Z' })
  submittedAt?: string;

  @ApiPropertyOptional({ example: '2026-04-08T14:06:00Z' })
  lastUpdatedAt?: string;
}