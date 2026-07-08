import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletAddressesResponseDto } from './add-wallet.dto';
import { LiriumCustomerAccountResponseDto } from './lirium.dto';

export type CustomerDataSource = 'wallets' | 'accounts' | 'details';

export class CustomerSourceErrorDto {
  @ApiProperty({
    enum: ['wallets', 'accounts', 'details'],
    example: 'details',
  })
  source: CustomerDataSource;

  @ApiProperty({
    example: 'Request failed with status code 500',
  })
  message: string;

  @ApiPropertyOptional({
    example: 500,
  })
  statusCode?: number;
}

export class CustomerWalletsSectionDto {
  @ApiProperty({
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    type: () => WalletAddressesResponseDto,
    nullable: true,
  })
  data: WalletAddressesResponseDto | null;

  @ApiPropertyOptional({
    type: () => CustomerSourceErrorDto,
    nullable: true,
  })
  error: CustomerSourceErrorDto | null;
}

export class CustomerAccountsSectionDto {
  @ApiProperty({
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    type: () => LiriumCustomerAccountResponseDto,
    nullable: true,
  })
  data: LiriumCustomerAccountResponseDto | null;

  @ApiPropertyOptional({
    type: () => CustomerSourceErrorDto,
    nullable: true,
  })
  error: CustomerSourceErrorDto | null;
}

export class CustomerDetailsSectionDto {
  @ApiProperty({
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  data: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: () => CustomerSourceErrorDto,
    nullable: true,
  })
  error: CustomerSourceErrorDto | null;
}

export class UnifiedCustomerResponseDto {
  @ApiProperty({
    description: 'Lirium customer identifier',
    example: '2fd88ea196c746238cad2a14ff418a61',
  })
  id: string;

  @ApiProperty({
    description: 'Girasol account ID / Lirium reference_id',
    example: 'acc123',
  })
  accountId: string;

  @ApiProperty({
    description: 'Local user email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    type: () => CustomerWalletsSectionDto,
  })
  wallets: CustomerWalletsSectionDto;

  @ApiProperty({
    type: () => CustomerAccountsSectionDto,
  })
  accounts: CustomerAccountsSectionDto;

  @ApiProperty({
    type: () => CustomerDetailsSectionDto,
  })
  details: CustomerDetailsSectionDto;

  @ApiProperty({
    example: false,
  })
  partialSuccess: boolean;

  @ApiProperty({
    type: [String],
    example: ['details'],
  })
  failedSources: CustomerDataSource[];
}
