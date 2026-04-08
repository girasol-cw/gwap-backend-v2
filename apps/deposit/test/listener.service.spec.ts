import { Test, TestingModule } from '@nestjs/testing';
import { ListenerService } from '../src/services/listener.service';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import {
  LiriumCustomerAccountResponseDto,
  LiriumOrderResponseDto,
} from '../src/dto/lirium.dto';

describe('ListenerService', () => {
  let service: ListenerService;

  const mockPool = {
    query: jest.fn(),
  };

  const mockLiriumService: jest.Mocked<Partial<LiriumRequestServiceAbstract>> = {
    getCustomerAccount: jest.fn(),
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
  };

  const mockDbService = {
    pool: mockPool,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listen', () => {
    it('should process customers and accounts end to end', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-1' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const accounts: LiriumCustomerAccountResponseDto = {
        accounts: [
          {
            currency: 'BTC',
            amount: '0.001',
          },
        ],
      };

      const createdOrder: LiriumOrderResponseDto = {
        id: 'sell-order-1',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'BTC',
          amount: '0.001',
        },
        sell: {
          settlement: {
            currency: 'USD',
            amount: '50.00',
          },
        },
      };

      const confirmedOrder: LiriumOrderResponseDto = {
        ...createdOrder,
        state: 'confirmed',
      };

      (mockLiriumService.getCustomerAccount as jest.Mock).mockResolvedValue(accounts);
      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(createdOrder);
      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(confirmedOrder);

      await service.listen('company-123');

      expect(mockLiriumService.getCustomerAccount).toHaveBeenCalledWith('customer-1');

      expect(mockLiriumService.createOrder).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        reference_id: expect.stringMatching(/^Sell\d{14}$/),
        operation: 'sell',
        asset: {
          currency: 'BTC',
          amount: '0.001',
        },
        sell: {
          currency: 'BTC',
          amount: '0.001',
        },
      });

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        order_id: 'sell-order-1',
        customer: {
          currency: 'USD',
          amount: '50.00',
        },
      });

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        'SELECT user_id FROM users WHERE company_id = $1',
        ['company-123'],
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO deposits (order_id, company_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5, $6)',
        ['sell-order-1', 'company-123', 'customer-1', '0.001', false, '50.00'],
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        'UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3 AND company_id = $4',
        [true, '50.00', 'sell-order-1', 'company-123'],
      );
    });

    it('should skip processing when customer accounts are empty', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-1' }],
      });

      (mockLiriumService.getCustomerAccount as jest.Mock).mockResolvedValue({
        accounts: [],
      });

      await service.listen('company-123');

      expect(mockLiriumService.getCustomerAccount).toHaveBeenCalledWith('customer-1');
      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
      expect(mockLiriumService.confirmOrder).not.toHaveBeenCalled();

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT user_id FROM users WHERE company_id = $1',
        ['company-123'],
      );
    });

    it('should continue processing next customer when createOrder fails for one account', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-1' }, { user_id: 'customer-2' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const accountsCustomer1: LiriumCustomerAccountResponseDto = {
        accounts: [
          {
            currency: 'BTC',
            amount: '0.001',
          },
        ],
      };

      const accountsCustomer2: LiriumCustomerAccountResponseDto = {
        accounts: [
          {
            currency: 'ETH',
            amount: '0.002',
          },
        ],
      };

      const createdOrderCustomer2: LiriumOrderResponseDto = {
        id: 'sell-order-2',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'ETH',
          amount: '0.002',
        },
        sell: {
          settlement: {
            currency: 'USD',
            amount: '25.00',
          },
        },
      };

      const confirmedOrderCustomer2: LiriumOrderResponseDto = {
        ...createdOrderCustomer2,
        state: 'confirmed',
      };

      (mockLiriumService.getCustomerAccount as jest.Mock)
        .mockResolvedValueOnce(accountsCustomer1)
        .mockResolvedValueOnce(accountsCustomer2);

      (mockLiriumService.createOrder as jest.Mock)
        .mockRejectedValueOnce(new Error('temporary lirium error'))
        .mockResolvedValueOnce(createdOrderCustomer2);

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(confirmedOrderCustomer2);

      await service.listen('company-123');

      expect(mockLiriumService.getCustomerAccount).toHaveBeenNthCalledWith(1, 'customer-1');
      expect(mockLiriumService.getCustomerAccount).toHaveBeenNthCalledWith(2, 'customer-2');

      expect(mockLiriumService.createOrder).toHaveBeenCalledTimes(2);
      expect(mockLiriumService.confirmOrder).toHaveBeenCalledTimes(1);
      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-2',
        order_id: 'sell-order-2',
        customer: {
          currency: 'USD',
          amount: '25.00',
        },
      });

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO deposits (order_id, company_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5, $6)',
        ['sell-order-2', 'company-123', 'customer-2', '0.002', false, '25.00'],
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        'UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3 AND company_id = $4',
        [true, '25.00', 'sell-order-2', 'company-123'],
      );
    });
  });

  describe('createDeposit', () => {
    it('should skip deposit creation when asset amount is zero', async () => {
      await (service as any).createDeposit(
        'customer-1',
        {
          currency: 'BTC',
          amount: '0',
        },
        'company-123',
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
      expect(mockLiriumService.confirmOrder).not.toHaveBeenCalled();
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should fallback to asset values when settlement is missing in confirmDeposit', async () => {
      const orderWithoutSettlement: LiriumOrderResponseDto = {
        id: 'sell-order-2',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'BTC',
          amount: '0.002',
        },
        sell: {},
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const confirmedOrder: LiriumOrderResponseDto = {
        ...orderWithoutSettlement,
        state: 'confirmed',
      };

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(confirmedOrder);

      await (service as any).confirmDeposit(
        'customer-1',
        orderWithoutSettlement,
        'company-123',
      );

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        order_id: 'sell-order-2',
        customer: {
          currency: 'BTC',
          amount: '0.002',
        },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE deposits SET confirmed = $1, amount_usd = $2 WHERE order_id = $3 AND company_id = $4',
        [true, undefined, 'sell-order-2', 'company-123'],
      );
    });

    it('should save deposit and not update it when confirmOrder fails', async () => {
      const createdOrder: LiriumOrderResponseDto = {
        id: 'sell-order-3',
        operation: 'sell',
        state: 'pending',
        asset: {
          currency: 'BTC',
          amount: '0.003',
        },
        sell: {
          settlement: {
            currency: 'USD',
            amount: '75.00',
          },
        },
      };

      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(createdOrder);
      (mockLiriumService.confirmOrder as jest.Mock).mockRejectedValue(
        new Error('confirm failed'),
      );

      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await (service as any).createDeposit(
        'customer-1',
        {
          currency: 'BTC',
          amount: '0.003',
        },
        'company-123',
      );

      expect(mockLiriumService.createOrder).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        reference_id: expect.stringMatching(/^Sell\d{14}$/),
        operation: 'sell',
        asset: {
          currency: 'BTC',
          amount: '0.003',
        },
        sell: {
          currency: 'BTC',
          amount: '0.003',
        },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO deposits (order_id, company_id, user_id, erc20_amount, confirmed, amount_usd) VALUES ($1, $2, $3, $4, $5, $6)',
        ['sell-order-3', 'company-123', 'customer-1', '0.003', false, '75.00'],
      );

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });
});