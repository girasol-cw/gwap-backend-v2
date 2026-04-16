import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { MetricsService } from './metrics.service';
import { DatabaseService, LiriumRequestServiceAbstract, LiriumKycServiceAbstract } from 'libs/shared';
import { GetWalletsService } from './services/get-wallets.service';
import { WithdrawService } from './services/withdraw.service';
import { OrderService } from './services/order.service';
import { DepositForwarderService } from './services/deposit-forwarder.service';
import { OrderIdentifierType } from './dto/order.dto';

describe('WalletServiceController', () => {
  let controller: WalletServiceController;

  const mockLiriumRequestService: jest.Mocked<Partial<LiriumRequestServiceAbstract>> = {
    createCustomer: jest.fn(),
    getCustomerAccount: jest.fn(),
  };

  const mockMetricsService: jest.Mocked<Partial<MetricsService>> = {
    getMetrics: jest.fn(),
  };

  const mockGetWalletsService: jest.Mocked<Partial<GetWalletsService>> = {
    getWallets: jest.fn(),
  };

  const mockLiriumKycService: jest.Mocked<Partial<LiriumKycServiceAbstract>> = {
    uploadKyc: jest.fn(),
  };

  const mockWithdrawService: jest.Mocked<Partial<WithdrawService>> = {
    createWithdraw: jest.fn(),
    confirmWithdraw: jest.fn(),
    getWithdrawState: jest.fn(),
    resendWithdrawConfirmationCode: jest.fn(),
  };
  const mockOrderService: jest.Mocked<Partial<OrderService>> = {
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
    getOrderState: jest.fn(),
    resendConfirmationCode: jest.fn(),
    getSwapQuote: jest.fn(),
  };
  const mockDepositForwarderService: jest.Mocked<Partial<DepositForwarderService>> = {
    forwardDeposit: jest.fn(),
  };
  const mockDatabaseService = {
    pool: {
      query: jest.fn(),
    },
  };

  const companyId: string = 'company-123';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletServiceController],
      providers: [
        {
          provide: LiriumRequestServiceAbstract,
          useValue: mockLiriumRequestService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: GetWalletsService,
          useValue: mockGetWalletsService,
        },
        {
          provide: LiriumKycServiceAbstract,
          useValue: mockLiriumKycService,
        },
        {
          provide: WithdrawService,
          useValue: mockWithdrawService,
        },
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: DepositForwarderService,
          useValue: mockDepositForwarderService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    controller = module.get<WalletServiceController>(WalletServiceController);
  });

  describe('addWallet', () => {
    const mockAddWalletRequest = {
      accountId: 'girasol-account-1',
      userId: 'user-1',
      userType: 'individual',
      label: 'Test User',
      firstName: 'Sebastian',
      middleName: '',
      lastName: 'Ortiz',
      birthDate: '1995-01-01',
      nationalIdCountryIso2: 'CO',
      nationalId: '123456789',
      citizenshipIso2: 'CO',
      addressLine1: 'Street 123',
      addressLine2: '',
      city: 'Medellin',
      state: 'Antioquia',
      countryIso2: 'CO',
      zipCode: '050001',
      taxId: '123456789',
      taxCountryIso2: 'CO',
      cellphone: '+573001112233',
      email: 'test@example.com',
    };

    it('should create wallet successfully with success message', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: [
          {
            address: '0xabc123',
            network: 'polygon',
            currency: 'USDC',
            asset_type: 'crypto',
          },
        ],
      };

      (mockLiriumRequestService.createCustomer as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.addWallet(companyId, mockAddWalletRequest as any);

      expect(result).toEqual({
        message: 'Success',
        data: serviceResponse,
      });

      expect(mockLiriumRequestService.createCustomer).toHaveBeenCalledWith(
        mockAddWalletRequest,
        companyId,
      );
    });

    it('should return warning when created wallet has no addresses', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: [],
      };

      (mockLiriumRequestService.createCustomer as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.addWallet(companyId, mockAddWalletRequest as any);

      expect(result).toEqual({
        message: 'Warning',
        data: serviceResponse,
      });
    });

    it('should return warning when created wallet address is null', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: null,
      };

      (mockLiriumRequestService.createCustomer as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.addWallet(companyId, mockAddWalletRequest as any);

      expect(result).toEqual({
        message: 'Warning',
        data: serviceResponse,
      });
    });

    it('should throw BadRequestException when createCustomer fails', async () => {
      (mockLiriumRequestService.createCustomer as jest.Mock).mockRejectedValue(
        new Error('Invalid request'),
      );

      await expect(
        controller.addWallet(companyId, mockAddWalletRequest as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve HttpException when createCustomer fails with one', async () => {
      (mockLiriumRequestService.createCustomer as jest.Mock).mockRejectedValue(
        new ConflictException('wallet already exists'),
      );

      await expect(
        controller.addWallet(companyId, mockAddWalletRequest as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getWallet', () => {
    const userId: string = 'user-1';

    it('should return wallet successfully with success message', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: [
          {
            address: '0xabc123',
            network: 'polygon',
            currency: 'USDC',
            asset_type: 'crypto',
          },
        ],
      };

      (mockGetWalletsService.getWallets as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.getWallet(companyId, userId);

      expect(result).toEqual({
        message: 'Success',
        data: serviceResponse,
      });

      expect(mockGetWalletsService.getWallets).toHaveBeenCalledWith(
        userId,
        companyId,
      );
    });

    it('should return warning when wallet has no addresses', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: [],
      };

      (mockGetWalletsService.getWallets as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.getWallet(companyId, userId);

      expect(result).toEqual({
        message: 'Warning',
        data: serviceResponse,
      });
    });

    it('should return warning when wallet address is null', async () => {
      const serviceResponse = {
        accountId: 'lirium-user-1',
        email: 'test@example.com',
        address: null,
      };

      (mockGetWalletsService.getWallets as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.getWallet(companyId, userId);

      expect(result).toEqual({
        message: 'Warning',
        data: serviceResponse,
      });
    });

    it('should throw NotFoundException when underlying service says not found', async () => {
      (mockGetWalletsService.getWallets as jest.Mock).mockRejectedValue(
        new Error('user not found'),
      );

      await expect(
        controller.getWallet(companyId, userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getWallet(companyId, userId),
      ).rejects.toThrow(`user with account id ${userId} not found`);
    });

    it('should throw BadRequestException for generic service errors', async () => {
      (mockGetWalletsService.getWallets as jest.Mock).mockRejectedValue(
        new Error('generic failure'),
      );

      await expect(
        controller.getWallet(companyId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should preserve HttpException for wallet lookup errors', async () => {
      (mockGetWalletsService.getWallets as jest.Mock).mockRejectedValue(
        new ConflictException('wallet service unavailable'),
      );

      await expect(
        controller.getWallet(companyId, userId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getMetrics', () => {
    it('should return prometheus metrics', async () => {
      (mockMetricsService.getMetrics as jest.Mock).mockResolvedValue(
        '# HELP test_metric test\n# TYPE test_metric counter\ntest_metric 1',
      );

      const result = await controller.getMetrics();

      expect(result).toBe(
        '# HELP test_metric test\n# TYPE test_metric counter\ntest_metric 1',
      );
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });
  });

  describe('forwardDeposit', () => {
    it('should delegate to DepositForwarderService', async () => {
      (mockDepositForwarderService.forwardDeposit as jest.Mock).mockResolvedValue(true);

      await expect(controller.forwardDeposit(companyId, 'order-123')).resolves.toBeUndefined();

      expect(mockDepositForwarderService.forwardDeposit).toHaveBeenCalledWith(
        'order-123',
        companyId,
      );
    });
  });

  describe('uploadKyc', () => {
    it('should map uploaded file into lirium dto and call uploadKyc', async () => {
      const file = {
        originalname: 'document.pdf',
        buffer: Buffer.from('test'),
      };

      await controller.uploadKyc(
        companyId,
        'customer-123',
        file,
        'application/pdf',
        'national_id_front' as any,
      );

      expect(mockLiriumKycService.uploadKyc).toHaveBeenCalledWith({
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        document_type: 'national_id_front',
        user_id: 'customer-123',
        file,
      }, companyId);
    });

    it('should fail when file is missing', async () => {
      await expect(
        controller.uploadKyc(
          companyId,
          'customer-123',
          undefined as any,
          'application/pdf',
          'national_id_front' as any,
        ),
      ).rejects.toThrow(new BadRequestException('file is required'));
    });

    it('should fail when file_type is missing', async () => {
      const file = {
        originalname: 'document.pdf',
        buffer: Buffer.from('test'),
      };
      await expect(
        controller.uploadKyc(
          companyId,
          'customer-123',
          file,
          '' as any,
          'national_id_front' as any,
        ),
      ).rejects.toThrow(new BadRequestException('file_type is required'));
    });

    it('should fail when document_type is missing', async () => {
      const file = {
        originalname: 'document.pdf',
        buffer: Buffer.from('test'),
      };
      await expect(
        controller.uploadKyc(
          companyId,
          'customer-123',
          file,
          'application/pdf',
          undefined as any,
        ),
      ).rejects.toThrow(new BadRequestException('document_type is required'));
    });
  });

  describe('createWithdraw', () => {
    const body = {
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

    it('should create withdraw successfully', async () => {
      const serviceResponse = {
        withdrawId: 'order-send-123',
        status: 'pending',
        requiresConfirmationCode: true,
        expiresAt: '2026-04-08T15:00:00Z',
      };

      (mockWithdrawService.createWithdraw as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.createWithdraw(
        companyId,
        'account-123',
        body as any,
      );

      expect(result).toEqual({
        message: 'Success',
        data: serviceResponse,
      });

      expect(mockWithdrawService.createWithdraw).toHaveBeenCalledWith(
        'account-123',
        body,
        companyId,
      );
    });

    it('should propagate withdraw creation errors', async () => {
      (mockWithdrawService.createWithdraw as jest.Mock).mockRejectedValue(
        new BadRequestException('invalid withdraw request'),
      );

      await expect(
        controller.createWithdraw(companyId, 'account-123', body as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmWithdraw', () => {
    const body = {
      confirmationCode: '123456',
    };

    it('should confirm withdraw successfully', async () => {
      const serviceResponse = {
        withdrawId: 'order-send-123',
        status: 'processing',
        requiresConfirmationCode: false,
        expiresAt: '2026-04-08T15:00:00Z',
      };

      (mockWithdrawService.confirmWithdraw as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.confirmWithdraw(
        companyId,
        'account-123',
        'order-send-123',
        body as any,
      );

      expect(result).toEqual({
        message: 'Success',
        data: serviceResponse,
      });

      expect(mockWithdrawService.confirmWithdraw).toHaveBeenCalledWith(
        'account-123',
        'order-send-123',
        body,
        companyId,
      );
    });

    it('should propagate withdraw confirmation errors', async () => {
      (mockWithdrawService.confirmWithdraw as jest.Mock).mockRejectedValue(
        new BadRequestException('invalid confirmation code'),
      );

      await expect(
        controller.confirmWithdraw(
          companyId,
          'account-123',
          'order-send-123',
          body as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWithdrawState', () => {
    it('should return withdraw state successfully', async () => {
      const serviceResponse = {
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
      };

      (mockWithdrawService.getWithdrawState as jest.Mock).mockResolvedValue(serviceResponse);

      const result = await controller.getWithdrawState(
        companyId,
        'account-123',
        'order-send-123',
      );

      expect(result).toEqual({
        message: 'Success',
        data: serviceResponse,
      });

      expect(mockWithdrawService.getWithdrawState).toHaveBeenCalledWith(
        'account-123',
        'order-send-123',
        companyId,
      );
    });

    it('should propagate withdraw state errors', async () => {
      (mockWithdrawService.getWithdrawState as jest.Mock).mockRejectedValue(
        new NotFoundException('withdraw not found'),
      );

      await expect(
        controller.getWithdrawState(
          companyId,
          'account-123',
          'order-send-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resendWithdrawConfirmationCode', () => {
    it('should resend confirmation code successfully', async () => {
      (mockWithdrawService.resendWithdrawConfirmationCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      await expect(
        controller.resendWithdrawConfirmationCode(
          companyId,
          'account-123',
          'order-send-123',
        ),
      ).resolves.toBeUndefined();

      expect(mockWithdrawService.resendWithdrawConfirmationCode).toHaveBeenCalledWith(
        'account-123',
        'order-send-123',
        companyId,
      );
    });

    it('should propagate resend confirmation code errors', async () => {
      (mockWithdrawService.resendWithdrawConfirmationCode as jest.Mock).mockRejectedValue(
        new InternalServerErrorException('resend failed'),
      );

      await expect(
        controller.resendWithdrawConfirmationCode(
          companyId,
          'account-123',
          'order-send-123',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('orders and swap', () => {
    it('should delegate createOrder', async () => {
      const response = { id: 'order-1' } as any;
      (mockOrderService.createOrder as jest.Mock).mockResolvedValue(response);

      const body = { userId: 'acc-1', operationType: 'swap', asset: { currency: 'USDC', amount: '10' } } as any;
      await expect(controller.createOrder(companyId, body)).resolves.toEqual(response);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(body, companyId);
    });

    it('should delegate swap quote', async () => {
      const quote = { from: { currency: 'USDC', amount: '10' }, to: { currency: 'BTC', amount: '0.0002' }, rate: '0.00002' };
      (mockOrderService.getSwapQuote as jest.Mock).mockResolvedValue(quote);

      await expect(
        controller.getSwapQuote({ asset: { currency: 'USDC', amount: '10' }, toCurrency: 'BTC' } as any),
      ).resolves.toEqual(quote);
    });

    it('should delegate confirmOrder using default lirium_id', async () => {
      const response = { id: 'order-1', state: 'processing' } as any;
      (mockOrderService.confirmOrder as jest.Mock).mockResolvedValue(response);

      const body = { userId: 'acc-1', orderId: 'ord_123', confirmationCode: '123456' } as any;
      await expect(controller.confirmOrder(companyId, body)).resolves.toEqual(response);
      expect(mockOrderService.confirmOrder).toHaveBeenCalledWith(
        body,
        companyId,
        OrderIdentifierType.LIRIUM_ID,
      );
    });

    it('should delegate confirmOrder using reference_id', async () => {
      const response = { id: 'order-1', state: 'processing' } as any;
      (mockOrderService.confirmOrder as jest.Mock).mockResolvedValue(response);

      const body = { userId: 'acc-1', orderId: 'Send-001', confirmationCode: '123456' } as any;
      await expect(
        controller.confirmOrder(companyId, body, OrderIdentifierType.REFERENCE_ID),
      ).resolves.toEqual(response);
      expect(mockOrderService.confirmOrder).toHaveBeenCalledWith(
        body,
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );
    });

    it('should delegate getOrderState using reference_id', async () => {
      const response = { id: 'order-1', state: 'pending' } as any;
      (mockOrderService.getOrderState as jest.Mock).mockResolvedValue(response);

      await expect(
        controller.getOrderState(
          companyId,
          'Send-001',
          'acc-1',
          OrderIdentifierType.REFERENCE_ID,
        ),
      ).resolves.toEqual(response);

      expect(mockOrderService.getOrderState).toHaveBeenCalledWith(
        'Send-001',
        'acc-1',
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );
    });

    it('should delegate resendConfirmationCode using reference_id', async () => {
      (mockOrderService.resendConfirmationCode as jest.Mock).mockResolvedValue(undefined);

      await expect(
        controller.resendConfirmationCode(
          companyId,
          'Send-001',
          'acc-1',
          OrderIdentifierType.REFERENCE_ID,
        ),
      ).resolves.toBeUndefined();

      expect(mockOrderService.resendConfirmationCode).toHaveBeenCalledWith(
        'Send-001',
        'acc-1',
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );
    });
  });

  describe('getCustomerAccount', () => {
    it('should resolve user mapping and query lirium account', async () => {
      (mockDatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ user_id: 'lirium-user-123' }],
      });
      (mockLiriumRequestService.getCustomerAccount as jest.Mock).mockResolvedValue({
        accounts: [],
      });

      const result = await controller.getCustomerAccount(companyId, 'account-123');
      expect(result).toEqual({ accounts: [] });
      expect(mockDatabaseService.pool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
        ['account-123', companyId],
      );
      expect(mockLiriumRequestService.getCustomerAccount).toHaveBeenCalledWith('lirium-user-123');
    });

    it('should throw NotFoundException when mapping does not exist', async () => {
      (mockDatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [],
      });

      await expect(
        controller.getCustomerAccount(companyId, 'missing-account'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should preserve HttpException from lirium account lookup', async () => {
      (mockDatabaseService.pool.query as jest.Mock).mockResolvedValue({
        rows: [{ user_id: 'lirium-user-123' }],
      });
      (mockLiriumRequestService.getCustomerAccount as jest.Mock).mockRejectedValue(
        new ConflictException('customer lookup conflict'),
      );

      await expect(
        controller.getCustomerAccount(companyId, 'account-123'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
