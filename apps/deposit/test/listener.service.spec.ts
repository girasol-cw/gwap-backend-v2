import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import {
  LiriumOrderResponseDto,
  LiriumCustomerAccountResponseDto,
} from '../src/dto/lirium.dto';
import { ListenerService } from '../src/services/listener.service';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import { AssetDto, OperationType } from '../src/dto/order.dto';

describe('ListenerService', () => {
  let service: ListenerService;
  let liriumService: jest.Mocked<LiriumRequestServiceAbstract>;
  let dbService: jest.Mocked<DatabaseService>;

  const mockPool = {
    query: jest.fn(),
  };

  const mockLiriumService = {
    getCustomerAccount: jest.fn(),
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
  };

  const mockDbService = {
    pool: mockPool,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListenerService,
        {
          provide: LiriumRequestServiceAbstract,
          useValue: mockLiriumService,
        },
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    service = module.get<ListenerService>(ListenerService);
    liriumService = module.get(LiriumRequestServiceAbstract);
    dbService = module.get(DatabaseService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listen', () => {
    it('should complete successfully', async () => {
      // Mock getCustomers to return test data
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer1' }, { user_id: 'customer2' }],
      });

      // Mock getCustomerAccount to return accounts
      const mockAccount: LiriumCustomerAccountResponseDto = {
        accounts: [
          {
            currency: 'BTC',
            amount: '0.001',
          } as AssetDto,
        ],
      };
      mockLiriumService.getCustomerAccount.mockResolvedValue(mockAccount);

      // Mock createOrder
      const mockOrder: LiriumOrderResponseDto = {
        id: 'order123',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'BTC',
          amount: '0.001',
        } as AssetDto,
        sell: {
          currency: 'USD',
          amount: '50.00',
          settlement: {
            currency: 'USD',
            amount: '50.00',
          },
        } as AssetDto,
      };
      mockLiriumService.createOrder.mockResolvedValue(mockOrder);

      // Mock confirmOrder
      const mockConfirmedOrder: LiriumOrderResponseDto = {
        ...mockOrder,
        state: 'confirmed',
      };
      mockLiriumService.confirmOrder.mockResolvedValue(mockConfirmedOrder);

      // Mock database operations
      mockPool.query.mockResolvedValue({ rows: [] });

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await service.listen();

      expect(loggerSpy).toHaveBeenCalledWith('Starting listener');
      expect(loggerSpy).toHaveBeenCalledWith('Listener finished');
    });

    it('should handle errors gracefully', async () => {
      // Mock getCustomers to throw an error
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      // The service should throw the error since there's no error handling in listen()
      await expect(service.listen()).rejects.toThrow('Database error');

      expect(loggerSpy).toHaveBeenCalledWith('Starting listener');
      // Listener finished should not be called when there's an error
      expect(loggerSpy).not.toHaveBeenCalledWith('Listener finished');
    });
  });

  describe('process', () => {
    it('should process all customers and their accounts', async () => {
      // Mock getCustomers
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer1' }],
      });

      // Mock getCustomerAccount
      const mockAccount: LiriumCustomerAccountResponseDto = {
        accounts: [
          {
            currency: 'BTC',
            amount: '0.001',
          } as AssetDto,
          {
            currency: 'ETH',
            amount: '0.01',
          } as AssetDto,
        ],
      };
      mockLiriumService.getCustomerAccount.mockResolvedValue(mockAccount);

      // Mock createOrder
      const mockOrder: LiriumOrderResponseDto = {
        id: 'order123',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'BTC',
          amount: '0.001',
        } as AssetDto,
        sell: {
          currency: 'USD',
          amount: '50.00',
          settlement: {
            currency: 'USD',
            amount: '50.00',
          },
        } as AssetDto,
      };
      mockLiriumService.createOrder.mockResolvedValue(mockOrder);

      // Mock confirmOrder
      const mockConfirmedOrder: LiriumOrderResponseDto = {
        ...mockOrder,
        state: 'confirmed',
      };
      mockLiriumService.confirmOrder.mockResolvedValue(mockConfirmedOrder);

      // Mock database operations
      mockPool.query.mockResolvedValue({ rows: [] });

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      // Access private method for testing
      await (service as any).process();

      expect(loggerSpy).toHaveBeenCalledWith('Getting customer account for customer1');
      expect(mockLiriumService.getCustomerAccount).toHaveBeenCalledWith('customer1');
      expect(mockLiriumService.createOrder).toHaveBeenCalledTimes(2); // One for each asset
    });

    it('should skip customers with no accounts', async () => {
      // Mock getCustomers
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer1' }],
      });

      // Mock getCustomerAccount to return empty accounts
      const mockAccount: LiriumCustomerAccountResponseDto = {
        accounts: [],
      };
      mockLiriumService.getCustomerAccount.mockResolvedValue(mockAccount);

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await (service as any).process();

      expect(loggerSpy).toHaveBeenCalledWith('Getting customer account for customer1');
      expect(mockLiriumService.getCustomerAccount).toHaveBeenCalledWith('customer1');
      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('getCustomers', () => {
    it('should return array of customer IDs', async () => {
      const mockCustomers = [
        { user_id: 'customer1' },
        { user_id: 'customer2' },
        { user_id: 'customer3' },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockCustomers,
      });

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      const result = await (service as any).getCustomers();

      expect(result).toEqual(['customer1', 'customer2', 'customer3']);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT user_id FROM Users ', []);
      expect(loggerSpy).toHaveBeenCalledWith('Getting customers');
    });

    it('should handle empty result set', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await (service as any).getCustomers();

      expect(result).toEqual([]);
    });
  });

  describe('createDeposit', () => {
    const mockAsset: AssetDto = {
      currency: 'BTC',
      amount: '0.001',
    };

    const mockOrder: LiriumOrderResponseDto = {
      id: 'order123',
      operation: 'sell',
      state: 'pending',
      asset: mockAsset,
      sell: {
        currency: 'USD',
        amount: '50.00',
        settlement: {
          currency: 'USD',
          amount: '50.00',
        },
      } as AssetDto,
    };

    beforeEach(() => {
      mockLiriumService.createOrder.mockResolvedValue(mockOrder);
      mockLiriumService.confirmOrder.mockResolvedValue({
        ...mockOrder,
        state: 'confirmed',
      });
      mockPool.query.mockResolvedValue({ rows: [] });
    });

    it('should create deposit successfully', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const consoleSpy = jest.spyOn(console, 'log');

      await (service as any).createDeposit('customer1', mockAsset);

      expect(loggerSpy).toHaveBeenCalledWith('Creating deposit for customer1 [object Object]');
      expect(consoleSpy).toHaveBeenCalledWith('asset', mockAsset);
      expect(mockLiriumService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'customer1',
          operation: OperationType.SELL,
          asset: mockAsset,
          reference_id: expect.stringMatching(/^Sell\d{14}$/),
        })
      );
    });

    it('should skip deposit when amount is 0', async () => {
      const zeroAsset: AssetDto = {
        currency: 'BTC',
        amount: '0',
      };

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await (service as any).createDeposit('customer1', zeroAsset);

      expect(loggerSpy).toHaveBeenCalledWith('Skipping deposit for customer1 because amount is 0');
      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });

    it('should skip deposit when amount is negative', async () => {
      const negativeAsset: AssetDto = {
        currency: 'BTC',
        amount: '-0.001',
      };

      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await (service as any).createDeposit('customer1', negativeAsset);

      expect(loggerSpy).toHaveBeenCalledWith('Skipping deposit for customer1 because amount is 0');
      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });

    it('should handle createOrder error', async () => {
      const error = new Error('Lirium API error');
      mockLiriumService.createOrder.mockRejectedValueOnce(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await (service as any).createDeposit('customer1', mockAsset);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Error creating deposit for customer1 [object Object]',
        error
      );
    });

    it('should generate unique reference_id', async () => {
      const asset1: AssetDto = { currency: 'BTC', amount: '0.001' };
      const asset2: AssetDto = { currency: 'ETH', amount: '0.01' };

      // Mock Date to control timestamps
      const mockDate1 = new Date('2025-01-01T10:00:00.000Z');
      const mockDate2 = new Date('2025-01-01T10:00:01.000Z');
      
      let callCount = 0;
      const originalDate = Date;
      global.Date = jest.fn(() => {
        callCount++;
        return callCount === 1 ? mockDate1 : mockDate2;
      }) as any;
      global.Date.now = originalDate.now;
      global.Date.UTC = originalDate.UTC;
      global.Date.parse = originalDate.parse;

      try {
        await (service as any).createDeposit('customer1', asset1);
        await (service as any).createDeposit('customer1', asset2);

        const calls = mockLiriumService.createOrder.mock.calls;
        expect(calls[0][0].reference_id).not.toBe(calls[1][0].reference_id);
        expect(calls[0][0].reference_id).toMatch(/^Sell\d{14}$/);
        expect(calls[1][0].reference_id).toMatch(/^Sell\d{14}$/);
      } finally {
        // Restore original Date
        global.Date = originalDate;
      }
    });
  });

  describe('confirmDeposit', () => {
    const mockOrder: LiriumOrderResponseDto = {
      id: 'order123',
      operation: 'sell',
      state: 'pending',
      asset: {
        currency: 'BTC',
        amount: '0.001',
      } as AssetDto,
      sell: {
        currency: 'USD',
        amount: '50.00',
        settlement: {
          currency: 'USD',
          amount: '50.00',
        },
      } as AssetDto,
    };

    const mockConfirmedOrder: LiriumOrderResponseDto = {
      ...mockOrder,
      state: 'confirmed',
    };

    beforeEach(() => {
      mockLiriumService.confirmOrder.mockResolvedValue(mockConfirmedOrder);
      mockPool.query.mockResolvedValue({ rows: [] });
    });

    it('should confirm deposit successfully', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      const consoleSpy = jest.spyOn(console, 'log');

      await (service as any).confirmDeposit('customer1', mockOrder);

      expect(loggerSpy).toHaveBeenCalledWith('Confirming deposit for customer1 ');
      expect(consoleSpy).toHaveBeenCalledWith('order', mockOrder);
      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer1',
        order_id: 'order123',
        customer: {
          currency: 'USD',
          amount: '50.00',
        },
      });
    });

    it('should handle confirmOrder error', async () => {
      const error = new Error('Confirmation failed');
      mockLiriumService.confirmOrder.mockRejectedValueOnce(error);

      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await (service as any).confirmDeposit('customer1', mockOrder);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Error confirming deposit for customer1 [object Object]',
        error
      );
    });

    it('should handle missing settlement data', async () => {
      const orderWithoutSettlement: LiriumOrderResponseDto = {
        ...mockOrder,
        sell: undefined,
      };

      await (service as any).confirmDeposit('customer1', orderWithoutSettlement);

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer1',
        order_id: 'order123',
        customer: {
          currency: '',
          amount: '',
        },
      });
    });
  });

  describe('saveDeposit', () => {
    const mockOrder: LiriumOrderResponseDto = {
      id: 'order123',
      operation: 'sell',
      state: 'confirmed',
      asset: {
        currency: 'BTC',
        amount: '0.001',
      } as AssetDto,
      sell: {
        currency: 'USD',
        amount: '50.00',
        settlement: {
          currency: 'USD',
          amount: '50.00',
        },
      } as AssetDto,
    };

    it('should save deposit to database', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await (service as any).saveDeposit('customer1', mockOrder);

      expect(loggerSpy).toHaveBeenCalledWith('Saving deposit for customer1 [object Object]');
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO deposits (order_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5)',
        ['order123', 'customer1', '0.001', true, '50.00']
      );
    });

    it('should handle pending state correctly', async () => {
      const pendingOrder: LiriumOrderResponseDto = {
        ...mockOrder,
        state: 'pending',
      };

      await (service as any).saveDeposit('customer1', pendingOrder);

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO deposits (order_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5)',
        ['order123', 'customer1', '0.001', false, '50.00']
      );
    });
  });

  describe('updateDeposit', () => {
    const mockOrder: LiriumOrderResponseDto = {
      id: 'order123',
      operation: 'sell',
      state: 'confirmed',
      asset: {
        currency: 'BTC',
        amount: '0.001',
      } as AssetDto,
      sell: {
        currency: 'USD',
        amount: '50.00',
        settlement: {
          currency: 'USD',
          amount: '50.00',
        },
      } as AssetDto,
    };

    it('should update deposit in database', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await (service as any).updateDeposit('customer1', mockOrder);

      expect(loggerSpy).toHaveBeenCalledWith('Updating deposit for customer1 [object Object]');
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3',
        [true, '50.00', 'order123']
      );
    });

    it('should handle missing settlement amount', async () => {
      const orderWithoutSettlement: LiriumOrderResponseDto = {
        ...mockOrder,
        sell: undefined,
      };

      await (service as any).updateDeposit('customer1', orderWithoutSettlement);

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3',
        [true, undefined, 'order123']
      );
    });
  });
});
