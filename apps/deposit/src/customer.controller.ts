import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { LiriumCustomerAccountResponseDto } from './dto/lirium.dto';
import { LiriumRequestServiceAbstract } from 'libs/shared';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from 'apps/wallet-service/src/dto/add-wallet.dto';

@Controller()
export class CustomerController {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
  ) {}

  @Get('customer/:accountId/account')
  @ApiOperation({
    summary: 'Get customer account information',
    description:
      'Retrieves account information for a specific customer by account ID',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Girasol account ID',
    example: 'acc123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer account information retrieved successfully',
    type: LiriumCustomerAccountResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - Invalid account ID or account not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized or missing API key in the request header',
    type: ErrorResponseDto,
  })
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
