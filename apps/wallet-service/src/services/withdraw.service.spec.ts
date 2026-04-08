import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import {
  ConfirmWithdrawRequestDto,
  WithdrawRequestDto,
} from '../dto/withdraw.dto';
import { OperationType } from 'apps/deposit/src/dto/order.dto';
import { LiriumOrderResponseDto } from 'apps/deposit/src/dto/lirium.dto';

describe('WithdrawService', () => {
  let service: WithdrawService;

  const mockPool = {
    query: jest.fn(),
  };

  const mockLiriumRequestService: jest.Mocked<
    Partial<LiriumRequestServiceAbstract>
  > = {
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
    getOrder: jest.fn(),
    resendOrderConfirmationCode: jest.fn(),
  };

  const mockDatabaseService = {
    pool: mockPool,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawService,
        {
          provide: LiriumRequestServiceAbstract,
          useValue: mockLiriumRequestService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<WithdrawService>(WithdrawService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWithdraw', () => {
    const body: WithdrawRequestDto = {
      currency: 'USDC',
      assetAmount: '10.00',
      network: 'polygon',
      destination: {
        type: 'crypto_currency_address',
        value: '0xabc123',
        amount: '9.75',
      },
      referenceId: 'withdraw-123',
    };

    const liriumResponse: LiriumOrderResponseDto = {
      id: 'order-send-123',
      operation: 'send',
      state: 'pending',
      asset: {
        currency: 'USDC',
        amount: '10.00',
      },
      send: {
        network: 'polygon',
        fees: '0.25',
        requires_confirmation_code: true,
        expires_at: '2026-04-08T15:00:00Z',
        destination: {
          type: 'crypto_currency_address',
          value: '0xabc123',
          amount: '9.75',
        },
      },
    };

    it('should resolve customer, create send order and map response', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      (mockLiriumRequestService.createOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      const result = await service.createWithdraw(
        'account-123',
        body,
        'company-123',
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
        ['account-123', 'company-123'],
      );

      expect(mockLiriumRequestService.createOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        reference_id: 'withdraw-123',
        operation: OperationType.SEND,
        asset: {
          currency: 'USDC',
          amount: '10.00',
        },
        send: {
          network: 'polygon',
          destination: {
            type: 'crypto_currency_address',
            value: '0xabc123',
            amount: '9.75',
          },
        },
      });

      expect(result).toEqual({
        withdrawId: 'order-send-123',
        status: 'pending',
        requiresConfirmationCode: true,
        expiresAt: '2026-04-08T15:00:00Z',
      });
    });

    it('should throw when account does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.createWithdraw('missing-account', body, 'company-123'),
      ).rejects.toThrow(
        new NotFoundException('user with account id missing-account not found'),
      );

      expect(mockLiriumRequestService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when network is missing', async () => {
      const invalidBody: WithdrawRequestDto = {
        ...body,
        network: '',
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.createWithdraw('account-123', invalidBody, 'company-123'),
      ).rejects.toThrow(new BadRequestException('Send network is required'));

      expect(mockLiriumRequestService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when destination type is missing', async () => {
      const invalidBody: WithdrawRequestDto = {
        ...body,
        destination: {
          ...body.destination,
          type: '',
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.createWithdraw('account-123', invalidBody, 'company-123'),
      ).rejects.toThrow(
        new BadRequestException('Send destination type is required'),
      );

      expect(mockLiriumRequestService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when destination value is missing', async () => {
      const invalidBody: WithdrawRequestDto = {
        ...body,
        destination: {
          ...body.destination,
          value: '',
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.createWithdraw('account-123', invalidBody, 'company-123'),
      ).rejects.toThrow(
        new BadRequestException('Send destination value is required'),
      );

      expect(mockLiriumRequestService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when both assetAmount and destination.amount are missing', async () => {
      const invalidBody: WithdrawRequestDto = {
        ...body,
        assetAmount: undefined,
        destination: {
          ...body.destination,
          amount: undefined,
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.createWithdraw('account-123', invalidBody, 'company-123'),
      ).rejects.toThrow(
        new BadRequestException(
          'Either assetAmount or destination.amount is required',
        ),
      );

      expect(mockLiriumRequestService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmWithdraw', () => {
    const body: ConfirmWithdrawRequestDto = {
      confirmationCode: '123456',
    };

    const liriumResponse: LiriumOrderResponseDto = {
      id: 'order-send-123',
      operation: 'send',
      state: 'processing',
      asset: {
        currency: 'USDC',
        amount: '10.00',
      },
      send: {
        network: 'polygon',
        requires_confirmation_code: false,
        expires_at: '2026-04-08T15:00:00Z',
        destination: {
          type: 'crypto_currency_address',
          value: '0xabc123',
          amount: '9.75',
        },
      },
    };

    it('should confirm withdraw using confirmation_code', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      (mockLiriumRequestService.confirmOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      const result = await service.confirmWithdraw(
        'account-123',
        'order-send-123',
        body,
        'company-123',
      );

      expect(mockLiriumRequestService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'order-send-123',
        confirmation_code: '123456',
      });

      expect(result).toEqual({
        withdrawId: 'order-send-123',
        status: 'processing',
        requiresConfirmationCode: false,
        expiresAt: '2026-04-08T15:00:00Z',
      });
    });

    it('should throw when account does not exist on confirm', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.confirmWithdraw(
          'missing-account',
          'order-send-123',
          body,
          'company-123',
        ),
      ).rejects.toThrow(
        new NotFoundException('user with account id missing-account not found'),
      );

      expect(mockLiriumRequestService.confirmOrder).not.toHaveBeenCalled();
    });
  });

  describe('getWithdrawState', () => {
    it('should map lirium order details to withdraw state response', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      const liriumResponse: LiriumOrderResponseDto = {
        id: 'order-send-123',
        operation: 'send',
        state: 'completed',
        created_at: '2026-04-08T14:00:00Z',
        submitted_at: '2026-04-08T14:01:00Z',
        last_updated_at: '2026-04-08T14:02:00Z',
        asset: {
          currency: 'USDC',
          amount: '10.00',
        },
        send: {
          network: 'polygon',
          fees: '0.25',
          requires_confirmation_code: false,
          expires_at: '2026-04-08T15:00:00Z',
          destination: {
            type: 'crypto_currency_address',
            value: '0xabc123',
            amount: '9.75',
            crypto_currency_transaction: {
              transaction_id: '0xtxhash',
            },
          },
        },
      };

      (mockLiriumRequestService.getOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      const result = await service.getWithdrawState(
        'account-123',
        'order-send-123',
        'company-123',
      );

      expect(mockLiriumRequestService.getOrder).toHaveBeenCalledWith(
        'customer-123',
        'order-send-123',
      );

      expect(result).toEqual({
        withdrawId: 'order-send-123',
        operation: 'send',
        status: 'completed',
        currency: 'USDC',
        assetAmount: '10.00',
        network: 'polygon',
        destinationType: 'crypto_currency_address',
        destinationValue: '0xabc123',
        destinationAmount: '9.75',
        fees: '0.25',
        requiresConfirmationCode: false,
        expiresAt: '2026-04-08T15:00:00Z',
        transactionId: '0xtxhash',
        createdAt: '2026-04-08T14:00:00Z',
        submittedAt: '2026-04-08T14:01:00Z',
        lastUpdatedAt: '2026-04-08T14:02:00Z',
      });
    });

    it('should throw when account does not exist on get state', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.getWithdrawState(
          'missing-account',
          'order-send-123',
          'company-123',
        ),
      ).rejects.toThrow(
        new NotFoundException('user with account id missing-account not found'),
      );

      expect(mockLiriumRequestService.getOrder).not.toHaveBeenCalled();
    });
  });

  describe('resendWithdrawConfirmationCode', () => {
    it('should resolve customer and resend confirmation code', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await service.resendWithdrawConfirmationCode(
        'account-123',
        'order-send-123',
        'company-123',
      );

      expect(
        mockLiriumRequestService.resendOrderConfirmationCode,
      ).toHaveBeenCalledWith('customer-123', 'order-send-123');
    });

    it('should throw when account does not exist on resend code', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.resendWithdrawConfirmationCode(
          'missing-account',
          'order-send-123',
          'company-123',
        ),
      ).rejects.toThrow(
        new NotFoundException('user with account id missing-account not found'),
      );

      expect(
        mockLiriumRequestService.resendOrderConfirmationCode,
      ).not.toHaveBeenCalled();
    });
  });
});