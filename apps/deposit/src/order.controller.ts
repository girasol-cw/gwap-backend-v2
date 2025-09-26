import { Body, Controller, Post } from '@nestjs/common';
import { OrderRequestDto, OrderResponseDto } from './dto/order.dto';

@Controller()
export class OrderController {
  constructor() {}
//TODO: have to validate if its necesary this endpoints
  // @Post('order')
  // async createOrder(@Body() body: OrderRequestDto): Promise<OrderResponseDto> {
  //   console.log(body);
  //   return new OrderResponseDto();
  // }
  // @Post('order/confirm')
  // async confirmOrder(@Body() body: OrderRequestDto): Promise<OrderResponseDto> {
  //   console.log(body);
  //   return new OrderResponseDto();
  // }
}
