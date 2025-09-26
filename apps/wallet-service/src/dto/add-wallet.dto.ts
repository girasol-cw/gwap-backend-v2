export class AddWalletRequestDto {
  userType: 'individual' | 'business';
  userId: string;
  email: string;
  accountId: string;
  label?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  nationalIdCountryIso2: string;
  nationalIdType: string;
  nationalId: string;
  citizenshipIso2: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  countryIso2: string;
  zipCode: string;
  taxId?: string;
  taxCountryIso2?: string;
  cellphone: string;
  name?: string;
}
export class AddWalletResponseDto {
  email: string;
  accountId: string;
  userId: string;
  address: walletDto[];
  
  errorChainIds: string[];
}

export class walletDto {
  address: string;
  network: string;
  currency: string;
  asset_type: string;
}

export class ErrorResponseDto {
  error_code: string;
  error_msg: string;
}
