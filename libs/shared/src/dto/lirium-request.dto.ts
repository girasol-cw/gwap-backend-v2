export type LiriumRequestDto = {
    type: 'individual' | 'business';
    reference_id: string;
    id?:string;
    created_at?:string;
    state?:string;
    profile: liriumProfileRequestDto;
    contact: ContactLiriumRequestDto;
    customer?:string;
}

export type liriumProfileRequestDto = {
    label?: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth: string;
    national_id_country: string;
    national_id_type: string;
    national_id: string;
    citizenship: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    country: string;
    zip_code: string;
    tax_id?: string;
    tax_country?: string;
    cellphone: string;
    name?: string;
}

export type ContactLiriumRequestDto = {
    email: string;
    cellphone: string;
}