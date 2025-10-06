import { ApiProperty } from '@nestjs/swagger';
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
  reference_id: string;
  operation: OperationType;
  asset: AssetDto;
  sell?: AssetDto;
};

export type LiriumOrderConfirmRequestDto = {
  customer_id: string;
  order_id: string;
  customer?:AssetDto;
};

export class LiriumCustomerAccountResponseDto {
  @ApiProperty({ 
    description: 'Array of customer accounts',
    type: [AssetDto]
  })
  accounts: AssetDto[]; 
}