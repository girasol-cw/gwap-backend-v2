import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderService } from '../src/services/order.Service';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import {
  OperationType,
  OrderConfirmRequestDto,
  OrderRequestDto,
} from '../src/dto/order.dto';
import { LiriumOrderResponseDto } from '../src/dto/lirium.dto';
import { OrderModel } from '../src/models/order';

describe('OrderService', () => {
  let service: OrderService;

  const mockPool = {
    query: jest.fn(),
  };

  const mockLiriumService: jest.Mocked<Partial<LiriumRequestServiceAbstract>> = {
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
    getCustomerAccount: jest.fn(),
    getWallets: jest.fn(),
    createCustomer: jest.fn(),
    getOrder: jest.fn(),
    resendOrderConfirmationCode: jest.fn(),
    getExchangeRates: jest.fn(),
  };

  const mockDbService = {
    pool: mockPool,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
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

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder - SEND', () => {
    const companyId = 'company-123';

    const request: OrderRequestDto = {
      userId: 'girasol-user-123',
      operationType: OperationType.SEND,
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

    it('should create a send order and persist send metadata', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      const result = await service.createOrder(request, companyId);

      expect(result).toEqual(liriumResponse);

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        'SELECT user_id FROM users WHERE girasol_account_id = $1 AND company_id = $2',
        ['girasol-user-123', companyId],
      );

      expect(mockLiriumService.createOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        reference_id: expect.stringMatching(/^Send\d{14}$/),
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

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO orders'),
        [
          'order-send-123',
          companyId,
          'customer-123',
          expect.stringMatching(/^Send\d{14}$/),
          OperationType.SEND,
          { currency: 'USDC', amount: '10.00' },
          'pending',
          expect.any(String),
          expect.any(String),
          expect.any(String),
          'polygon',
          '0.25',
          'crypto_currency_address',
          '0xabc123',
          '9.75',
          null,
          true,
        ],
      );
    });

    it('should allow destination.amount without asset.amount', async () => {
      const requestWithoutAssetAmount: OrderRequestDto = {
        userId: 'girasol-user-123',
        operationType: OperationType.SEND,
        asset: {
          currency: 'USDC',
        },
        send: {
          network: 'polygon',
          destination: {
            type: 'crypto_currency_address',
            value: '0xabc123',
            amount: '9.75',
          },
        },
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      await service.createOrder(requestWithoutAssetAmount, companyId);

      expect(mockLiriumService.createOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        reference_id: expect.stringMatching(/^Send\d{14}$/),
        operation: OperationType.SEND,
        asset: {
          currency: 'USDC',
          amount: undefined,
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
    });

    it('should throw when network is missing', async () => {
      const invalidRequest: OrderRequestDto = {
        ...request,
        send: {
          ...request.send!,
          network: '',
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(service.createOrder(invalidRequest, companyId)).rejects.toThrow(
        new BadRequestException('Send network is required'),
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when destination type is missing', async () => {
      const invalidRequest: OrderRequestDto = {
        ...request,
        send: {
          ...request.send!,
          destination: {
            ...request.send!.destination,
            type: '',
          },
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(service.createOrder(invalidRequest, companyId)).rejects.toThrow(
        new BadRequestException('Send destination type is required'),
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when destination value is missing', async () => {
      const invalidRequest: OrderRequestDto = {
        ...request,
        send: {
          ...request.send!,
          destination: {
            ...request.send!.destination,
            value: '',
          },
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(service.createOrder(invalidRequest, companyId)).rejects.toThrow(
        new BadRequestException('Send destination value is required'),
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });

    it('should throw when both asset.amount and destination.amount are missing', async () => {
      const invalidRequest: OrderRequestDto = {
        ...request,
        asset: {
          currency: 'USDC',
        },
        send: {
          ...request.send!,
          destination: {
            ...request.send!.destination,
            amount: undefined,
          },
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(service.createOrder(invalidRequest, companyId)).rejects.toThrow(
        new BadRequestException(
          'Either asset.amount or send.destination.amount is required',
        ),
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmOrder - SEND', () => {
    const companyId = 'company-123';

    const confirmRequest: OrderConfirmRequestDto = {
      userId: 'girasol-user-123',
      orderId: 'order-send-123',
      confirmationCode: '123456',
    };

    const storedOrder: OrderModel = {
      id: 'order-send-123',
      userId: 'customer-123',
      referenceId: 'Send20260408112233',
      operation: OperationType.SEND,
      asset: {
        currency: 'USDC',
        amount: '10.00',
      },
      settlement: undefined as any,
      status: 'pending',
      createdAt: '2026-04-08T11:22:33Z',
      orderBody: '{}',
      orderResponse: '{}',
      network: 'polygon',
      fees: '0.25',
      destinationType: 'crypto_currency_address',
      destinationValue: '0xabc123',
      destinationAmount: '9.75',
      requiresConfirmationCode: true,
    };

    const confirmedResponse: LiriumOrderResponseDto = {
      id: 'order-send-123',
      operation: 'send',
      state: 'processing',
      asset: {
        currency: 'USDC',
        amount: '10.00',
      },
      send: {
        network: 'polygon',
        fees: '0.25',
        requires_confirmation_code: false,
        destination: {
          type: 'crypto_currency_address',
          value: '0xabc123',
          amount: '9.75',
        },
      },
    };

    it('should confirm send order with confirmation_code and without customer payload', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [storedOrder],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(
        confirmedResponse,
      );

      const result = await service.confirmOrder(confirmRequest, companyId);

      expect(result).toEqual(confirmedResponse);

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'order-send-123',
        confirmation_code: '123456',
      });

      const confirmPayload = (mockLiriumService.confirmOrder as jest.Mock).mock
        .calls[0][0];
      expect(confirmPayload.customer).toBeUndefined();

      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        'UPDATE orders SET status = $1, order_response = $2, fees = $3, destination_amount = $4, requires_confirmation_code = $5 WHERE id = $6 AND company_id = $7',
        [
          'processing',
          JSON.stringify(confirmedResponse),
          '0.25',
          '9.75',
          false,
          'order-send-123',
          companyId,
        ],
      );
    });

    it('should throw when stored order does not exist', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      await expect(service.confirmOrder(confirmRequest, companyId)).rejects.toThrow(
        new NotFoundException('Order with id order-send-123 not found'),
      );

      expect(mockLiriumService.confirmOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmOrder - SELL', () => {
    const companyId = 'company-123';

    const confirmRequest: OrderConfirmRequestDto = {
      userId: 'girasol-user-123',
      orderId: 'order-sell-123',
    };

    const storedOrder: OrderModel = {
      id: 'order-sell-123',
      userId: 'customer-123',
      referenceId: 'Sell20260408112233',
      operation: OperationType.SELL,
      asset: {
        currency: 'BTC',
        amount: '0.001',
      },
      settlement: {
        currency: 'USD',
        amount: '50.00',
      },
      status: 'pending',
      createdAt: '2026-04-08T11:22:33Z',
      orderBody: '{}',
      orderResponse: '{}',
      network: undefined as any,
      fees: undefined as any,
      destinationType: undefined as any,
      destinationValue: undefined as any,
      destinationAmount: undefined as any,
      requiresConfirmationCode: false,
    };

    const confirmedResponse: LiriumOrderResponseDto = {
      id: 'order-sell-123',
      operation: 'sell',
      state: 'processing',
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

    it('should confirm sell order with customer payload', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [storedOrder],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(
        confirmedResponse,
      );

      await service.confirmOrder(confirmRequest, companyId);

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'order-sell-123',
        customer: {
          currency: 'USD',
          amount: '50.00',
        },
      });
    });

    it('should fallback to asset when settlement amount is missing', async () => {
      const storedOrderWithoutSettlement: OrderModel = {
        ...storedOrder,
        settlement: {
          currency: 'USD',
          amount: undefined as any,
        },
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [storedOrderWithoutSettlement],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(
        confirmedResponse,
      );

      await service.confirmOrder(confirmRequest, companyId);

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'order-sell-123',
        customer: {
          currency: 'BTC',
          amount: '0.001',
        },
      });
    });
  });

  describe('confirmOrder validations', () => {
    it('should throw when orderId is missing', async () => {
      const request: OrderConfirmRequestDto = {
        userId: 'girasol-user-123',
        orderId: '' as any,
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.confirmOrder(request, 'company-123'),
      ).rejects.toThrow(new BadRequestException('Lirium Order ID is required'));

      expect(mockLiriumService.confirmOrder).not.toHaveBeenCalled();
    });
  });

  describe('getOrderState', () => {
    it('should validate local order and then fetch fresh state from lirium', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-send-123',
            },
          ],
        });

      const liriumOrder: LiriumOrderResponseDto = {
        id: 'order-send-123',
        operation: 'send',
        state: 'completed',
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
            crypto_currency_transaction: {
              transaction_id: '0xtxhash',
            },
          },
        },
      };

      (mockLiriumService.getOrder as jest.Mock).mockResolvedValue(liriumOrder);

      const result = await service.getOrderState(
        'order-send-123',
        'girasol-user-123',
        'company-123',
      );

      expect(result).toEqual(liriumOrder);
      expect(mockLiriumService.getOrder).toHaveBeenCalledWith(
        'customer-123',
        'order-send-123',
      );
    });

    it('should throw when user does not map to a customer', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.getOrderState(
          'order-send-123',
          'missing-user',
          'company-123',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Customer with girasol account id missing-user not found',
        ),
      );

      expect(mockLiriumService.getOrder).not.toHaveBeenCalled();
    });
  });

  describe('resendConfirmationCode', () => {
    it('should validate local order and resend code through lirium', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-send-123',
            },
          ],
        });

      await service.resendConfirmationCode(
        'order-send-123',
        'girasol-user-123',
        'company-123',
      );

      expect(mockLiriumService.resendOrderConfirmationCode).toHaveBeenCalledWith(
        'customer-123',
        'order-send-123',
      );
    });

    it('should throw when user does not map to a customer', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        service.resendConfirmationCode(
          'order-send-123',
          'missing-user',
          'company-123',
        ),
      ).rejects.toThrow(
        new NotFoundException(
          'Customer with girasol account id missing-user not found',
        ),
      );

      expect(
        mockLiriumService.resendOrderConfirmationCode,
      ).not.toHaveBeenCalled();
    });
  });
  describe('createOrder - SWAP', () => {
    const companyId = 'company-123';

    const request: OrderRequestDto = {
      userId: 'girasol-user-123',
      operationType: OperationType.SWAP,
      asset: {
        currency: 'USDC',
        amount: '100.00',
      },
      swap: {
        currency: 'BTC',
      },
    };

    const liriumResponse: LiriumOrderResponseDto = {
      id: 'order-swap-123',
      operation: 'swap',
      state: 'pending',
      asset: {
        currency: 'USDC',
        amount: '100.00',
      },
      swap: {
        currency: 'BTC',
        amount: '0.002',
      },
    };

    it('should create a swap order correctly', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(
        liriumResponse,
      );

      const result = await service.createOrder(request, companyId);

      expect(result).toEqual(liriumResponse);

      expect(mockLiriumService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'customer-123',
          operation: OperationType.SWAP,
          reference_id: expect.stringMatching(/^Swap\d{14}$/),
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          swap: {
            currency: 'BTC',
            amount: '100.00',
          },
        }),
      );
    });

    it('should throw when swap currency is missing', async () => {
      const invalidRequest: OrderRequestDto = {
        ...request,
        swap: {
          currency: '',
        },
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'customer-123' }],
      });

      await expect(
        service.createOrder(invalidRequest, companyId),
      ).rejects.toThrow(
        new BadRequestException('Swap currency is required'),
      );

      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });
  });
  describe('confirmOrder - SWAP', () => {
    const companyId = 'company-123';

    const confirmRequest: OrderConfirmRequestDto = {
      userId: 'girasol-user-123',
      orderId: 'order-swap-123',
    };

    const storedOrder: OrderModel = {
      id: 'order-swap-123',
      userId: 'customer-123',
      referenceId: 'Swap20260408112233',
      operation: OperationType.SWAP,
      asset: {
        currency: 'USDC',
        amount: '100.00',
      },
      settlement: undefined as any,
      status: 'pending',
      createdAt: '2026-04-08T11:22:33Z',
      orderBody: '{}',
      orderResponse: '{}',
      network: undefined as any,
      fees: undefined as any,
      destinationType: undefined as any,
      destinationValue: undefined as any,
      destinationAmount: undefined as any,
      requiresConfirmationCode: false,
    };

    const confirmedResponse: LiriumOrderResponseDto = {
      id: 'order-swap-123',
      operation: 'swap',
      state: 'processing',
      asset: {
        currency: 'USDC',
        amount: '100.00',
      },
      swap: {
        currency: 'BTC',
        amount: '0.002',
      },
    };

    it('should confirm swap order without customer payload', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ user_id: 'customer-123' }],
        })
        .mockResolvedValueOnce({
          rows: [storedOrder],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(
        confirmedResponse,
      );

      const result = await service.confirmOrder(confirmRequest, companyId);

      expect(result).toEqual(confirmedResponse);

      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'order-swap-123',
      });
    });
  });
  describe('getSwapQuote', () => {
    it('should return a valid swap quote', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: '0.00002',
          ask: '0.000021',
        },
      ]);

      const result = await service.getSwapQuote({
        asset: {
          currency: 'USDC',
          amount: '100.00',
        },
        toCurrency: 'BTC',
      });

      expect(result).toEqual({
        from: {
          currency: 'USDC',
          amount: '100.00',
        },
        to: {
          currency: 'BTC',
          amount: '0.00200000',
        },
        rate: '0.00002',
      });

      expect(mockLiriumService.getExchangeRates).toHaveBeenCalled();
    });

    it('should throw when amount is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: '0.00002',
          ask: '0.000021',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '0',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid amount'));
    });

    it('should throw when currency pair is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'USDC',
          bid: '1',
          ask: '1',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'USDC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid currency pair'));
    });

    it('should throw when exchange rate is not found', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'ETH',
          bid: '0.0005',
          ask: '0.0006',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(
        new NotFoundException('No exchange rate found for USDC -> BTC'),
      );
    });

    it('should throw when exchange rate is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: 'abc',
          ask: '0.000021',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid exchange rate'));
    });
  });
  describe('getSwapQuote', () => {
    it('should return a valid swap quote', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: '0.00002',
          ask: '0.000021',
        },
      ]);

      const result = await service.getSwapQuote({
        asset: {
          currency: 'USDC',
          amount: '100.00',
        },
        toCurrency: 'BTC',
      });

      expect(result).toEqual({
        from: {
          currency: 'USDC',
          amount: '100.00',
        },
        to: {
          currency: 'BTC',
          amount: '0.00200000',
        },
        rate: '0.00002',
      });

      expect(mockLiriumService.getExchangeRates).toHaveBeenCalled();
    });

    it('should throw when amount is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: '0.00002',
          ask: '0.000021',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '0',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid amount'));
    });

    it('should throw when currency pair is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'USDC',
          bid: '1',
          ask: '1',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'USDC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid currency pair'));
    });

    it('should throw when exchange rate is not found', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'ETH',
          bid: '0.0005',
          ask: '0.0006',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(
        new NotFoundException('No exchange rate found for USDC -> BTC'),
      );
    });

    it('should throw when exchange rate is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        {
          currency: 'BTC',
          bid: 'abc',
          ask: '0.000021',
        },
      ]);

      await expect(
        service.getSwapQuote({
          asset: {
            currency: 'USDC',
            amount: '100.00',
          },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid exchange rate'));
    });
  });
});