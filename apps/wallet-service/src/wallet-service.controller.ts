import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CompanyId,
  DatabaseService,
  LiriumFileDto,
  LiriumFileType,
  LiriumKycServiceAbstract,
  SkipCompanyId,
} from 'libs/shared';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import {
  AddWalletRequestDto,
  AddWalletResponseDto,
  ErrorResponseDto,
} from './dto/add-wallet.dto';
import { LiriumCustomerAccountResponseDto, LiriumOrderResponseDto } from './dto/lirium.dto';
import {
  OrderIdentifierType,
  OrderConfirmRequestDto,
  OrderRequestDto,
  SwapQuoteRequestDto,
  SwapQuoteResponseDto,
} from './dto/order.dto';
import {
  ConfirmWithdrawRequestDto,
  WithdrawRequestDto,
  WithdrawResponseDto,
  WithdrawStateResponseDto,
} from './dto/withdraw.dto';
import { globalRegistry, MetricsService } from './metrics.service';
import { GetWalletsService } from './services/get-wallets.service';
import { OrderService } from './services/order.service';
import { WithdrawService } from './services/withdraw.service';
import { DepositForwarderService } from './services/deposit-forwarder.service';

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

@ApiTags('Wallet Service')
@Controller()
export class WalletServiceController {

  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly metricsService: MetricsService,
    private readonly getWalletsService: GetWalletsService,
    private readonly liriumKycService: LiriumKycServiceAbstract,
    private readonly withdrawService: WithdrawService,
    private readonly orderService: OrderService,
    private readonly depositForwarderService: DepositForwarderService,
    private readonly databaseService: DatabaseService,
  ) { }

  @Post('addWallet')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Create a new wallet for a user from Girasol',
    description: 'Creates a new wallet for the specified user with all required KYC information'
  })
  @ApiBody({
    type: AddWalletRequestDto,
    description: 'User information and wallet creation parameters'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet created successfully!',
    type: AddWalletResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or wallet creation failed',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized or missing API key in the request header',
    type: ErrorResponseDto,
  })
  async addWallet(
    @CompanyId() companyId: string,
    @Body() body: AddWalletRequestDto,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.liriumRequestService.createCustomer(body, companyId);

      return {
        message:
          result.address == null || result.address.length === 0
            ? 'Warning'
            : 'Success',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  @Get('wallet/:userId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Get wallet information for a user',
    description: 'Retrieves wallet addresses and information for the specified user ID'
  })
  @ApiParam({
    name: 'userId',
    description: 'Girasol account ID',
    example: 'user123',
    required: true
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet information retrieved successfully',
    type: AddWalletResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized or missing API key in the request header',
    type: ErrorResponseDto,
  })
  async getWallet(
    @CompanyId() companyId: string,
    @Param('userId') userId: string,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.getWalletsService.getWallets(userId, companyId);
      return {
        message:
          result.address == null || result.address.length === 0
            ? 'Warning'
            : 'Success',
        data: result,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`user with id ${userId} not found`);
      }

      throw new BadRequestException(error);
    }
  }

  @Get('customer/:accountId/account')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Get customer account information',
    description: 'Retrieves account information for a specific customer by account ID',
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
  async getCustomerAccount(
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
  ): Promise<LiriumCustomerAccountResponseDto> {
    try {
      const result = await this.databaseService.pool.query<{ user_id: string }>(
        'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
        [accountId, companyId],
      );

      if (result.rows.length === 0) {
        throw new NotFoundException(`Customer with account id ${accountId} not found`);
      }

      return this.liriumRequestService.getCustomerAccount(result.rows[0].user_id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error);
    }
  }

  @Post('order')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Create a Lirium order (buy/sell/swap/send)',
  })
  @ApiBody({
    type: OrderRequestDto,
  })
  async createOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderRequestDto,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.createOrder(body, companyId);
  }

  @Post('swap/quote')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Get swap quote',
  })
  @ApiBody({
    type: SwapQuoteRequestDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SwapQuoteResponseDto,
  })
  async getSwapQuote(
    @Body() body: SwapQuoteRequestDto,
  ): Promise<SwapQuoteResponseDto> {
    return this.orderService.getSwapQuote(body);
  }

  @Post('order/confirm')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Confirm an existing Lirium order',
  })
  @ApiBody({
    type: OrderConfirmRequestDto,
  })
  @ApiQuery({
    name: 'idType',
    required: false,
    enum: OrderIdentifierType,
    description: 'Identifier type used in orderId. Defaults to lirium_id.',
  })
  async confirmOrder(
    @CompanyId() companyId: string,
    @Body() body: OrderConfirmRequestDto,
    @Query('idType') idType: OrderIdentifierType = OrderIdentifierType.LIRIUM_ID,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.confirmOrder(body, companyId, idType);
  }

  @Get('order/:orderId/user/:userId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Get order state',
  })
  @ApiParam({ name: 'orderId', example: 'ord_123' })
  @ApiParam({ name: 'userId', example: 'acc123' })
  @ApiQuery({
    name: 'idType',
    required: false,
    enum: OrderIdentifierType,
    description: 'Identifier type used in orderId. Defaults to lirium_id.',
  })
  async getOrderState(
    @CompanyId() companyId: string,
    @Param('orderId') orderId: string,
    @Param('userId') userId: string,
    @Query('idType') idType: OrderIdentifierType = OrderIdentifierType.LIRIUM_ID,
  ): Promise<LiriumOrderResponseDto> {
    return this.orderService.getOrderState(orderId, userId, companyId, idType);
  }

  @Post('order/:orderId/resend-code/user/:userId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Resend confirmation code for order',
  })
  @ApiParam({ name: 'orderId', example: 'ord_123' })
  @ApiParam({ name: 'userId', example: 'acc123' })
  @ApiQuery({
    name: 'idType',
    required: false,
    enum: OrderIdentifierType,
    description: 'Identifier type used in orderId. Defaults to lirium_id.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendConfirmationCode(
    @CompanyId() companyId: string,
    @Param('orderId') orderId: string,
    @Param('userId') userId: string,
    @Query('idType') idType: OrderIdentifierType = OrderIdentifierType.LIRIUM_ID,
  ): Promise<void> {
    return this.orderService.resendConfirmationCode(orderId, userId, companyId, idType);
  }

  @Get('metrics')
  @SkipCompanyId()
  @Header('Content-Type', globalRegistry.contentType)
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns Prometheus-formatted metrics for monitoring and observability'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics data in Prometheus format',
    schema: {
      type: 'string',
      example: '# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 123'
    }
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  @Post('kyc/:customerId/upload')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'file_type', 'document_type'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        file_type: {
          type: 'string',
          example: 'passport_front',
        },
        document_type: {
          type: 'string',
          enum: Object.values(LiriumFileType),
          example: LiriumFileType.ID_FRONT,
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload KYC document',
    description: 'Uploads a KYC document for a customer',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    example: 'customer123',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'KYC document uploaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  async uploadKyc(
    @CompanyId() companyId: string,
    @Param('customerId') customerId: string,
    @UploadedFile() file: any,
    @Body('file_type') fileType: string,
    @Body('document_type') documentType: LiriumFileType,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!fileType) {
      throw new BadRequestException('file_type is required');
    }

    if (!documentType) {
      throw new BadRequestException('document_type is required');
    }

    const liriumFile: LiriumFileDto = new LiriumFileDto();
    liriumFile.file_name = file.originalname;
    liriumFile.file_type = fileType;
    liriumFile.document_type = documentType;
    liriumFile.user_id = customerId;
    liriumFile.file = file;

    await this.liriumKycService.uploadKyc(liriumFile, companyId);
  }

  @Post('deposits/:orderId/forward')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Forward a stored deposit to the downstream settlement service',
    description: 'Attempts an idempotent forward for a deposit captured from Lirium webhooks.',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Lirium receive order identifier',
    example: '2fd88ea196c746238cad2a14ff418a61',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Deposit forwarded or already processed',
  })
  async forwardDeposit(
    @CompanyId() companyId: string,
    @Param('orderId') orderId: string,
  ): Promise<void> {
    await this.depositForwarderService.forwardDeposit(orderId, companyId);
  }

  @Post('wallet/:accountId/withdraw')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Create a withdraw for a wallet',
    description: 'Creates a Lirium send order for the specified wallet account',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Wallet account identifier',
    example: 'acc123',
  })
  @ApiBody({
    type: WithdrawRequestDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdraw created successfully',
    schema: {
      example: {
        message: 'Success',
        data: {
          withdrawId: 'ord_123',
          status: 'pending',
          requiresConfirmationCode: true,
          expiresAt: '2026-04-08T14:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Wallet account identifier',
    example: 'acc123',
  })
  @ApiParam({
    name: 'withdrawId',
    description: 'Withdraw identifier',
    example: 'ord_123',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Confirmation code resent successfully',
  })
  async createWithdraw(
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
    @Body() body: WithdrawRequestDto,
  ): Promise<{ message: string; data: WithdrawResponseDto }> {
    const result = await this.withdrawService.createWithdraw(accountId, body, companyId);

    return {
      message: 'Success',
      data: result,
    };
  }

  @Post('wallet/:accountId/withdraw/:withdrawId/confirm')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Confirm a withdraw',
    description: 'Confirms a previously created Lirium send order',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Wallet account identifier',
    example: 'acc123',
  })
  @ApiParam({
    name: 'withdrawId',
    description: 'Withdraw identifier',
    example: 'ord_123',
  })
  @ApiBody({
    type: ConfirmWithdrawRequestDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdraw confirmed successfully',
    schema: {
      example: {
        message: 'Success',
        data: {
          withdrawId: 'ord_123',
          status: 'submitted',
          requiresConfirmationCode: false,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request parameters',
  })
  async confirmWithdraw(
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
    @Param('withdrawId') withdrawId: string,
    @Body() body: ConfirmWithdrawRequestDto,
  ): Promise<{ message: string; data: WithdrawResponseDto }> {
    const result = await this.withdrawService.confirmWithdraw(
      accountId,
      withdrawId,
      body,
      companyId,
    );

    return {
      message: 'Success',
      data: result,
    };
  }

  @ApiParam({
    name: 'accountId',
    description: 'Wallet account identifier',
    example: 'acc123',
  })
  @ApiParam({
    name: 'withdrawId',
    description: 'Withdraw identifier',
    example: 'ord_123',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdraw state retrieved successfully',
    schema: {
      example: {
        message: 'Success',
        data: {
          withdrawId: 'ord_123',
          operation: 'send',
          status: 'pending',
          currency: 'USDC',
          assetAmount: '10.00',
          network: 'polygon',
        },
      },
    },
  })
  @Get('wallet/:accountId/withdraw/:withdrawId')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Get withdraw state',
    description: 'Returns the current state of a Lirium send order',
  })
  async getWithdrawState(
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
    @Param('withdrawId') withdrawId: string,
  ): Promise<{ message: string; data: WithdrawStateResponseDto }> {
    const result = await this.withdrawService.getWithdrawState(
      accountId,
      withdrawId,
      companyId,
    );

    return {
      message: 'Success',
      data: result,
    };
  }

  @Post('wallet/:accountId/withdraw/:withdrawId/resend-code')
  @ApiHeader({ name: 'x-company-id', description: 'Tenant/company identifier (multi-tenant)', required: true })
  @ApiOperation({
    summary: 'Resend withdraw confirmation code',
    description: 'Resends the security code required to confirm a Lirium send order',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendWithdrawConfirmationCode(
    @CompanyId() companyId: string,
    @Param('accountId') accountId: string,
    @Param('withdrawId') withdrawId: string,
  ): Promise<void> {
    await this.withdrawService.resendWithdrawConfirmationCode(
      accountId,
      withdrawId,
      companyId,
    );
  }
}
