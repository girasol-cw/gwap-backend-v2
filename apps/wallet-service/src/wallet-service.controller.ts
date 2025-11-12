import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Param,
  Header,
  NotFoundException,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import { AddWalletRequestDto, AddWalletResponseDto, ErrorResponseDto } from './dto/add-wallet.dto';
import { globalRegistry, MetricsService } from './metrics.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { GetWalletsService } from './src/get-wallets.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { LiriumFileDto, LiriumFileType, LiriumKycServiceAbstract } from 'libs/shared';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

@ApiTags('Wallet Service')
@Controller()
export class WalletServiceController {

  constructor(
    private readonly liriumRequestService: LiriumRequestServiceAbstract,
    private readonly metricsService: MetricsService,
    private readonly getWalletsService: GetWalletsService,
    private readonly liriumKycService: LiriumKycServiceAbstract,
  ) { }

  @Post('addWallet')
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
    @Body() body: AddWalletRequestDto,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.liriumRequestService.createCustomer(body);

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
    @Param('userId') userId: string,
  ): Promise<{ message: string; data: AddWalletResponseDto }> {
    try {
      const result = await this.getWalletsService.getWallets(userId);
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

  @Get('metrics')
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
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {

      limits: { fileSize: MAX_SIZE_BYTES },
    }),
  )
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
    @Param('customerId') customerId: string,
    @UploadedFile() file: any,
    @Body('file_type') fileType:string ,
    @Body('document_type') documentType: LiriumFileType,
  ): Promise<void> {

    const liriumFile: LiriumFileDto = new LiriumFileDto();
    liriumFile.file_name = file.originalname;
    liriumFile.file_type = fileType;
    liriumFile.document_type = documentType;
    liriumFile.user_id = customerId;
    liriumFile.file = file;


    await this.liriumKycService.uploadKyc(liriumFile);
  }
}
