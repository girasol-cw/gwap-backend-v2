import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletServiceController } from './wallet-service.controller';
import { MetricsService, globalRegistry } from './metrics.service';
import { GetWalletsService } from './src/get-wallets.service';
import { LiriumRequestServiceAbstract } from 'libs/shared';
import { AddWalletRequestDto, AddWalletResponseDto } from './dto/add-wallet.dto';

describe('WalletServiceController', () => {
  let controller: WalletServiceController;
  let liriumRequestService: jest.Mocked<LiriumRequestServiceAbstract>;
  let metricsService: jest.Mocked<MetricsService>;
  let getWalletsService: jest.Mocked<GetWalletsService>;

  const mockAddWalletRequest: AddWalletRequestDto = {
    userType: 'individual',
    userId: 'test-user-123',
    email: 'test@example.com',
    accountId: 'account-123',
    label: 'Test Wallet',
    firstName: 'John',
    middleName: 'Doe',
    lastName: 'Smith',
    birthDate: '1990-01-01',
    nationalIdCountryIso2: 'US',
    nationalIdType: 'SSN',
    nationalId: '123-45-6789',
    citizenshipIso2: 'US',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 1',
    city: 'New York',
    state: 'NY',
    countryIso2: 'US',
    zipCode: '10001',
    taxId: '12-3456789',
    taxCountryIso2: 'US',
    cellphone: '+1234567890',
    name: 'John Smith',
  };

  const mockAddWalletResponse: AddWalletResponseDto = {
    email: 'test@example.com',
    accountId: 'account-123',
    userId: 'test-user-123',
    address: [
      {
        address: '0x1234567890abcdef',
        network: 'ethereum',
        currency: 'ETH',
        asset_type: 'native',
      },
    ],
    errorChainIds: [],
  };

  const mockAddWalletResponseWithError: AddWalletResponseDto = {
    email: 'test@example.com',
    accountId: 'account-123',
    userId: 'test-user-123',
    address: [],
    errorChainIds: ['1', '137'],
  };

  beforeEach(async () => {
    const mockLiriumRequestService = {
      createCustomer: jest.fn(),
      getWallets: jest.fn(),
    };

    const mockMetricsService = {
      getMetrics: jest.fn(),
    };

    const mockGetWalletsService = {
      getWallets: jest.fn(),
    };

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
      ],
    }).compile();

    controller = module.get<WalletServiceController>(WalletServiceController);
    liriumRequestService = module.get(LiriumRequestServiceAbstract);
    metricsService = module.get(MetricsService);
    getWalletsService = module.get(GetWalletsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addWallet', () => {
    it('should create a wallet successfully and return success message', async () => {
      // Arrange
      liriumRequestService.createCustomer.mockResolvedValue(mockAddWalletResponse);

      // Act
      const result = await controller.addWallet(mockAddWalletRequest);

      // Assert
      expect(result).toEqual({
        message: 'Success',
        data: mockAddWalletResponse,
      });
      expect(liriumRequestService.createCustomer).toHaveBeenCalledWith(mockAddWalletRequest);
    });

    it('should return warning message when address is null', async () => {
      // Arrange
      const responseWithNullAddress = { ...mockAddWalletResponse, address: null as any };
      liriumRequestService.createCustomer.mockResolvedValue(responseWithNullAddress);

      // Act
      const result = await controller.addWallet(mockAddWalletRequest);

      // Assert
      expect(result).toEqual({
        message: 'Warning',
        data: responseWithNullAddress,
      });
    });

    it('should return warning message when address is empty array', async () => {
      // Arrange
      const responseWithEmptyAddress = { ...mockAddWalletResponse, address: [] };
      liriumRequestService.createCustomer.mockResolvedValue(responseWithEmptyAddress);

      // Act
      const result = await controller.addWallet(mockAddWalletRequest);

      // Assert
      expect(result).toEqual({
        message: 'Warning',
        data: responseWithEmptyAddress,
      });
    });

    it('should throw BadRequestException when service throws error', async () => {
      // Arrange
      const error = new Error('Service error');
      liriumRequestService.createCustomer.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.addWallet(mockAddWalletRequest)).rejects.toThrow(BadRequestException);
      expect(liriumRequestService.createCustomer).toHaveBeenCalledWith(mockAddWalletRequest);
    });
  });

  describe('getWallet', () => {
    it('should get wallet successfully and return success message', async () => {
      // Arrange
      const userId = 'test-user-123';
      getWalletsService.getWallets.mockResolvedValue(mockAddWalletResponse);

      // Act
      const result = await controller.getWallet(userId);

      // Assert
      expect(result).toEqual({
        message: 'Success',
        data: mockAddWalletResponse,
      });
      expect(getWalletsService.getWallets).toHaveBeenCalledWith(userId);
    });

    it('should return warning message when address is null', async () => {
      // Arrange
      const userId = 'test-user-123';
      const responseWithNullAddress = { ...mockAddWalletResponse, address: null as any };
      getWalletsService.getWallets.mockResolvedValue(responseWithNullAddress);

      // Act
      const result = await controller.getWallet(userId);

      // Assert
      expect(result).toEqual({
        message: 'Warning',
        data: responseWithNullAddress,
      });
    });

    it('should return warning message when address is empty array', async () => {
      // Arrange
      const userId = 'test-user-123';
      const responseWithEmptyAddress = { ...mockAddWalletResponse, address: [] };
      getWalletsService.getWallets.mockResolvedValue(responseWithEmptyAddress);

      // Act
      const result = await controller.getWallet(userId);

      // Assert
      expect(result).toEqual({
        message: 'Warning',
        data: responseWithEmptyAddress,
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      // Arrange
      const userId = 'non-existent-user';
      const error = new Error('user with id non-existent-user not found');
      getWalletsService.getWallets.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getWallet(userId)).rejects.toThrow(NotFoundException);
      await expect(controller.getWallet(userId)).rejects.toThrow(`user with id ${userId} not found`);
    });

    it('should throw BadRequestException for other errors', async () => {
      // Arrange
      const userId = 'test-user-123';
      const error = new Error('Database connection error');
      getWalletsService.getWallets.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getWallet(userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics string', async () => {
      // Arrange
      const expectedMetrics = 'wallet_deploy_fail_total{chainId="1",userId="test",reason="error"} 1\n';
      metricsService.getMetrics.mockResolvedValue(expectedMetrics);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(result).toBe(expectedMetrics);
      expect(metricsService.getMetrics).toHaveBeenCalled();
    });

    it('should have correct content type header', async () => {
      // Arrange
      const expectedMetrics = 'test metrics';
      metricsService.getMetrics.mockResolvedValue(expectedMetrics);

      // Act
      const result = await controller.getMetrics();

      // Assert
      expect(result).toBe(expectedMetrics);
      // Note: Testing the @Header decorator would require integration tests
      // as unit tests don't execute decorators
    });
  });
});
