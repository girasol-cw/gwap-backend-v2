import { Body, Controller, Post } from '@nestjs/common';
import { OrderConfirmRequestDto, OrderRequestDto, OrderResponseDto } from './dto/order.dto';
import { OrderService } from './services/order.Service';
import { LiriumOrderResponseDto } from './dto/lirium.dto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('order')
  async createOrder(@Body() body: OrderRequestDto): Promise<LiriumOrderResponseDto> {
    return await this.orderService.createOrder(body);
    
  }
  @Post('order/confirm')
  async confirmOrder(@Body() body: OrderConfirmRequestDto): Promise<LiriumOrderResponseDto> {
    return await this.orderService.confirmOrder(body);
  }
}
