import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  OrderConfirmRequestDto,
  OrderRequestDto,
  SwapQuoteRequestDto,
  SwapQuoteResponseDto,
} from './dto/order.dto';
import { OrderService } from './services/order.Service';
import { LiriumOrderResponseDto } from './dto/lirium.dto';
import { CompanyId } from 'libs/shared';
import { ApiHeader } from '@nestjs/swagger';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Post('order')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async createOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.createOrder(body, companyId);
  }
  @Post('swap/quote')
  @ApiHeader({
    name: 'x-company-id',
    description: 'Tenant/company identifier (multi-tenant)',
    required: true,
  })
  async getSwapQuote(
    @Body() body: SwapQuoteRequestDto,
  ): Promise<SwapQuoteResponseDto> {
    return this.orderService.getSwapQuote(body);
  }

  @Post('order/confirm')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async confirmOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderConfirmRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.confirmOrder(body, companyId);
  }
  @Get('order/:orderId/user/:userId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async getOrderState(
    @CompanyId() companyId: string,
    @Param('orderId') orderId: string,
    @Param('userId') userId: string,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.getOrderState(orderId, userId, companyId);
  }
  @Post('order/:orderId/resend-code/user/:userId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  async resendConfirmationCode(
    @CompanyId() companyId: string,
    @Param('orderId') orderId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.orderService.resendConfirmationCode(orderId, userId, companyId);
  }
}
