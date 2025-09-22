import { Body, Controller, Post } from '@nestjs/common';
import { OrderRequestDto, OrderResponseDto } from './dto/order.dto';

@Controller()
export class OrderServiceController {
  constructor() {}

  @Post('order')
  async createOrder(
    @Body() body: OrderRequestDto,
  ): Promise<OrderResponseDto> {
    return new OrderResponseDto();
  }
}
