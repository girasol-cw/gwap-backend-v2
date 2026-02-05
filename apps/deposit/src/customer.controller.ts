import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { LiriumCustomerAccountResponseDto } from './dto/lirium.dto';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { ApiOperation, ApiParam, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ErrorResponseDto } from 'apps/wallet-service/src/dto/add-wallet.dto';
import { CompanyId } from 'libs/shared';
import { DatabaseService } from 'libs/shared';

@Controller()
export class CustomerController {
  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly dbService: DatabaseService,
  ) {}

  @Get('customer/:accountId/account')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
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
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto> {
    try {
      const result = await this.dbService.pool.query<{ user_id: string }>(
        'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
        [accountId, companyId],
      );
      if (result.rows.length === 0) {
        throw new NotFoundException(`Customer with account id ${accountId} not found`);
      }
      const liriumUserId = result.rows[0].user_id;
      const response =
        await this.liriumRequestService.getCustomerAccount(liriumUserId);
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(error);
    }
  }
}
