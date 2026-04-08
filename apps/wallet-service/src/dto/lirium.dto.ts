import { ApiProperty } from '@nestjs/swagger';
import {
  AssetDto,
  OperationType,
  SendOperationDto,
} from './order.dto';

export type LiriumTradeRequestDto = {
  settlement?: AssetDto;
  commission?: {
    type?: string;
    value?: string;
  };
  expires_at?: string;
  requires_confirmation_code?: boolean;
};

export type LiriumSwapRequestDto = {
  currency: string;
  amount?: string;
  expires_at?: string;
  requires_confirmation_code?: boolean;
};

export type LiriumOrderRequestDto = {
  customer_id: string;
  reference_id: string;
  operation: OperationType;
  asset: AssetDto;
  sell?: LiriumTradeRequestDto;
  buy?: LiriumTradeRequestDto;
  swap?: LiriumSwapRequestDto;
  send?: SendOperationDto;
};

export class LiriumCustomerAccountResponseDto {
  @ApiProperty({
    description: 'Customer accounts',
    type: () => [AssetDto],
  })
  accounts: AssetDto[];
}

export type LiriumSendDestinationTransactionDto = {
  transaction_id?: string;
};

export type LiriumSendDestinationLiriumTransferDto = {
  customer_id?: string;
  order_id?: string;
};

export type LiriumSendDestinationResponseDto = {
  type: string;
  value: string;
  amount?: string;
  crypto_currency_transaction?: LiriumSendDestinationTransactionDto;
  lirium_transfer?: LiriumSendDestinationLiriumTransferDto;
};

export type LiriumSendResponseDto = {
  network: string;
  fees?: string;
  expires_at?: string;
  requires_confirmation_code?: boolean;
  destination: LiriumSendDestinationResponseDto;
};

export type LiriumTradeResponseDto = {
  settlement?: AssetDto;
  commission?: {
    type?: string;
    value?: string;
  };
  expires_at?: string;
  requires_confirmation_code?: boolean;
};

export type LiriumSwapResponseDto = {
  currency?: string;
  amount?: string;
  expires_at?: string;
  requires_confirmation_code?: boolean;
};

export type LiriumOrderResponseDto = {
  id: string;
  operation: string;
  state: string;
  reference_id?: string;
  created_at?: string;
  submitted_at?: string;
  last_updated_at?: string;
  customer_id?: string;
  asset: AssetDto;
  sell?: LiriumTradeResponseDto;
  buy?: LiriumTradeResponseDto;
  swap?: LiriumSwapResponseDto;
  send?: LiriumSendResponseDto;
};

export type LiriumOrderConfirmRequestDto = {
  customer_id: string;
  order_id: string;
  confirmation_code?: string;
  reference_id?: string;
  customer?: AssetDto;
};

export type LiriumExchangeRateDto = {
  currency: string;
  bid: string;
  ask: string;
};

export type LiriumExchangeRatesResponseDto = LiriumExchangeRateDto[];
