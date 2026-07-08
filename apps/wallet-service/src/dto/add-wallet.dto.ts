import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const LIRIUM_NATIONAL_ID_TYPES = [
  'passport',
  'driver_license',
  'national_id',
] as const;

export type LiriumNationalIdType = (typeof LIRIUM_NATIONAL_ID_TYPES)[number];

const NATIONAL_ID_TYPE_ALIASES: Record<string, LiriumNationalIdType> = {
  passport: 'passport',
  driver_license: 'driver_license',
  driverlicense: 'driver_license',
  licencia: 'driver_license',
  licencia_de_conducir: 'driver_license',
  license: 'driver_license',
  national_id: 'national_id',
  nationalid: 'national_id',
  cedula: 'national_id',
  cedula_de_ciudadania: 'national_id',
  dni: 'national_id',
};

function normalizeLookupKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeNationalIdType(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const key = normalizeLookupKey(value);
  return NATIONAL_ID_TYPE_ALIASES[key] ?? key;
}

export type WalletProvisionStatus =
  | 'pending_wallet_sync'
  | 'wallet_sync_failed'
  | 'ready';

export class walletDto {
  @ApiProperty({ 
    description: 'Wallet address',
    example: '0x742d35Cc6634C0532925a3b8D3Ac4e4C6a8e9c7e'
  })
  address: string;

  @ApiProperty({ 
    description: 'Blockchain network',
    example: 'ethereum'
  })
  network: string;

  @ApiProperty({ 
    description: 'Currency symbol',
    example: 'ETH'
  })
  currency: string;

  @ApiProperty({ 
    description: 'Type of asset',
    example: 'coin'
  })
  asset_type: string;
}

export class AddWalletRequestDto {
  @IsIn(['individual', 'business'])
  @ApiProperty({ 
    description: 'Type of user account',
    enum: ['individual', 'business'],
    example: 'individual'
  })
  userType: 'individual' | 'business';

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'Girasol account ID used as the idempotent external key and Lirium reference_id for this customer',
    example: 'acc123'
  })
  accountId: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Optional label for the wallet',
    required: false,
    example: 'My Wallet'
  })
  label?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'User first name',
    example: 'John'
  })
  firstName: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'User middle name',
    required: false,
    example: 'Michael'
  })
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe'
  })
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'User birth date in YYYY-MM-DD format',
    example: '1990-01-01'
  })
  birthDate: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'Country ISO2 code for national ID',
    example: 'US'
  })
  nationalIdCountryIso2: string;

  @Transform(({ value }) => normalizeNationalIdType(value), { toClassOnly: true })
  @IsIn(LIRIUM_NATIONAL_ID_TYPES)
  @ApiProperty({ 
    description: 'National ID type supported by Lirium. Common aliases like cedula are normalized to national_id.',
    enum: LIRIUM_NATIONAL_ID_TYPES,
    example: 'national_id'
  })
  nationalIdType: LiriumNationalIdType;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'National ID number',
    example: 'A12345678'
  })
  nationalId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'Citizenship country ISO2 code',
    example: 'US'
  })
  citizenshipIso2: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'Primary address line',
    example: '123 Main St'
  })
  addressLine1: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Secondary address line',
    required: false,
    example: 'Apt 4B'
  })
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'City name',
    example: 'New York'
  })
  city: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'State or province',
    example: 'NY'
  })
  state: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'Country ISO2 code',
    example: 'US'
  })
  countryIso2: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'ZIP or postal code',
    example: '10001'
  })
  zipCode: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Tax ID number',
    required: false,
    example: '12-3456789'
  })
  taxId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Tax country ISO2 code',
    required: false,
    example: 'US'
  })
  taxCountryIso2?: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ 
    description: 'User cellphone number',
    example: '+1234567890'
  })
  cellphone: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Business name (for business accounts)',
    required: false,
    example: 'My Company Inc USED when userType is business'
  })
  name?: string;
}
export class AddWalletResponseDto {
  @ApiProperty({ 
    description: 'Lirium customer identifier',
    example: '2fd88ea196c746238cad2a14ff418a61'
  })
  id: string;

  @ApiProperty({ 
    description: 'Girasol account ID used as the customer reference_id in Lirium',
    example: 'acc123'
  })
  accountId: string;

  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({ 
    description: 'Array of wallet addresses',
    type: [walletDto]
  })
  address: walletDto[];

  @ApiProperty({ 
    description: 'Array of chain IDs that failed to deploy',
    type: [String],
    required: false,
    example: ['1', '137']
  })
  errorChainIds?: string[];

  @ApiProperty({
    description: 'Provisioning status for the customer and wallet synchronization flow',
    enum: ['pending_wallet_sync', 'wallet_sync_failed', 'ready'],
    required: false,
    example: 'ready',
  })
  provisionStatus?: WalletProvisionStatus;

}

export class WalletAddressesResponseDto {
  address: walletDto[];
}

export class WalletResponseEnvelopeDto {
  @ApiProperty({
    description: 'High-level outcome for the wallet operation',
    example: 'Success',
  })
  message: string;

  @ApiProperty({
    description: 'Provisioning status for create-wallet flows',
    enum: ['pending_wallet_sync', 'wallet_sync_failed', 'ready'],
    required: false,
    example: 'ready',
  })
  provisionStatus?: WalletProvisionStatus;

  @ApiProperty({
    description: 'Wallet-related response payload',
    type: AddWalletResponseDto,
  })
  data: AddWalletResponseDto;
}

export class ErrorResponseDto {
  @ApiProperty({ 
    description: 'Error code',
    example: 'VALIDATION_ERROR'
  })
  error_code: string;

  @ApiProperty({ 
    description: 'Error message',
    example: 'Error message'
  })
  error_msg: string;
}
