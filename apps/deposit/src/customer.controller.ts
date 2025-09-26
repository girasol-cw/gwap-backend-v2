import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { OrderRequestDto, OrderResponseDto } from './dto/order.dto';
import { LiriumCustomerAccountResponseDto } from './dto/lirium.dto';
import { LiriumRequestServiceAbstract } from 'libs/shared';

@Controller()
export class CustomerController {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
  ) {}

  @Get('customer/:accountId/account')
  async getCustomerAccount(
    @Param('accountId') accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto> {
    try {
      const response =
        await this.liriumRequestService.getCustomerAccount(accountId);
      return response;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }
}
