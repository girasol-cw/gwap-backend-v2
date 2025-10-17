import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ 
    description: 'Type of user account',
    enum: ['individual', 'business'],
    example: 'individual'
  })
  userType: 'individual' | 'business';

  @ApiProperty({ 
    description: 'Unique identifier for the user',
    example: 'user123'
  })
  userId: string;

  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({ 
    description: 'Account identifier',
    example: 'acc123'
  })
  accountId: string;

  @ApiProperty({ 
    description: 'Optional label for the wallet',
    required: false,
    example: 'My Wallet'
  })
  label?: string;

  @ApiProperty({ 
    description: 'User first name',
    example: 'John'
  })
  firstName: string;

  @ApiProperty({ 
    description: 'User middle name',
    required: false,
    example: 'Michael'
  })
  middleName?: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe'
  })
  lastName: string;

  @ApiProperty({ 
    description: 'User birth date in YYYY-MM-DD format',
    example: '1990-01-01'
  })
  birthDate: string;

  @ApiProperty({ 
    description: 'Country ISO2 code for national ID',
    example: 'US'
  })
  nationalIdCountryIso2: string;

  @ApiProperty({ 
    description: 'Type of national ID',
    example: 'passport'
  })
  nationalIdType: string;

  @ApiProperty({ 
    description: 'National ID number',
    example: 'A12345678'
  })
  nationalId: string;

  @ApiProperty({ 
    description: 'Citizenship country ISO2 code',
    example: 'US'
  })
  citizenshipIso2: string;

  @ApiProperty({ 
    description: 'Primary address line',
    example: '123 Main St'
  })
  addressLine1: string;

  @ApiProperty({ 
    description: 'Secondary address line',
    required: false,
    example: 'Apt 4B'
  })
  addressLine2?: string;

  @ApiProperty({ 
    description: 'City name',
    example: 'New York'
  })
  city: string;

  @ApiProperty({ 
    description: 'State or province',
    example: 'NY'
  })
  state: string;

  @ApiProperty({ 
    description: 'Country ISO2 code',
    example: 'US'
  })
  countryIso2: string;

  @ApiProperty({ 
    description: 'ZIP or postal code',
    example: '10001'
  })
  zipCode: string;

  @ApiProperty({ 
    description: 'Tax ID number',
    required: false,
    example: '12-3456789'
  })
  taxId?: string;

  @ApiProperty({ 
    description: 'Tax country ISO2 code',
    required: false,
    example: 'US'
  })
  taxCountryIso2?: string;

  @ApiProperty({ 
    description: 'User cellphone number',
    example: '+1234567890'
  })
  cellphone: string;

  @ApiProperty({ 
    description: 'Business name (for business accounts)',
    required: false,
    example: 'My Company Inc USED when userType is business'
  })
  name?: string;
}
export class AddWalletResponseDto {
  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({ 
    description: 'Account identifier',
    example: 'acc123'
  })
  accountId: string;

  @ApiProperty({ 
    description: 'Unique identifier for the user',
    example: 'user123'
  })
  userId: string;

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
