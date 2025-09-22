export class AddWalletRequestDto {
    userType: "individual" | "business";
    userId: string;
    email: string;
    accountId: string;
    label?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    date_of_birth: string;
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
}
export class AddWalletResponseDto {
    email: string;
    accountId: string;
    userId: string
    address: string[];

    errorChainIds: string[]
}
