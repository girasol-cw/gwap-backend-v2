import { Body, Controller, Post } from '@nestjs/common';
import { OrderConfirmRequestDto, OrderRequestDto } from './dto/order.dto';
import { OrderService } from './services/order.Service';
import { LiriumOrderResponseDto } from './dto/lirium.dto';
import { CompanyId } from 'libs/shared';
import { ApiHeader } from '@nestjs/swagger';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('order')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async createOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return await this.orderService.createOrder(body, companyId);
  }

  @Post('order/confirm')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async confirmOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderConfirmRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return await this.orderService.confirmOrder(body, companyId);
  }
}
