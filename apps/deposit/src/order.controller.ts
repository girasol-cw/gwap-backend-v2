import { Body, Controller, Post } from '@nestjs/common';
import { OrderRequestDto, OrderResponseDto } from './dto/order.dto';

@Controller()
export class OrderController {
  constructor() {}

  @Post('order')
  async createOrder(@Body() body: OrderRequestDto): Promise<OrderResponseDto> {
    console.log(body);
    return new OrderResponseDto();
  }
}
