import { AssetDto, OperationType } from "../dto/order.dto";

export class OrderModel {
  id: string;
  userId: string;
  referenceId: string;
  operation: OperationType;
  asset: AssetDto;
  settlement: AssetDto;
  status: string;
  createdAt: string;
  orderBody: string;
  orderResponse: string;
  network: string;
  fees: string;
  destinationType: string;
  destinationValue: string;
  destinationAmount: string;
}