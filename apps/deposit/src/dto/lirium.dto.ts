import { AssetDto, OperationType } from './order.dto';

export type LiriumOrderResponseDto = {
  id: string;
  operation: string;
  state: string;
  asset: AssetDto;
  sell?: AssetDto;
  buy?: AssetDto;
};

export type LiriumOrderRequestDto = {
  customer_id: string;
  operation: OperationType;
  asset: AssetDto;
  sell?: AssetDto;
};

export type LiriumCustomerAccountResponseDto = {
  accounts: AssetDto[]; 
};
