import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, LiriumRequestServiceAbstract } from 'libs/shared';
import { OrderService } from './order.service';
import {
  OperationType,
  OrderConfirmRequestDto,
  OrderIdentifierType,
  OrderRequestDto,
} from '../dto/order.dto';
import { LiriumOrderResponseDto } from '../dto/lirium.dto';

describe('OrderService', () => {
  let service: OrderService;

  const mockPool = {
    query: jest.fn(),
  };

  const mockLiriumService: jest.Mocked<Partial<LiriumRequestServiceAbstract>> = {
    createOrder: jest.fn(),
    confirmOrder: jest.fn(),
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

  describe('createOrder', () => {
    const companyId = 'company-123';
    const request: OrderRequestDto = {
      userId: 'acc-123',
      operationType: OperationType.SEND,
      asset: { currency: 'USDC', amount: '10.00' },
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
      id: 'ord-send-123',
      operation: 'send',
      state: 'pending',
      asset: { currency: 'USDC', amount: '10.00' },
      send: {
        network: 'polygon',
        destination: {
          type: 'crypto_currency_address',
          value: '0xabc123',
          amount: '9.75',
        },
      },
    };

    it('creates send order and persists it', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [] });
      (mockLiriumService.createOrder as jest.Mock).mockResolvedValue(liriumResponse);

      const result = await service.createOrder(
        JSON.parse(JSON.stringify(request)),
        companyId,
      );

      expect(result).toEqual(liriumResponse);
      expect(mockLiriumService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'customer-123',
          operation: OperationType.SEND,
        }),
      );
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO orders'),
        expect.any(Array),
      );
    });

    it('fails when customer account does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createOrder(JSON.parse(JSON.stringify(request)), companyId),
      ).rejects.toThrow(
        new NotFoundException('Customer with girasol account id acc-123 not found'),
      );
      expect(mockLiriumService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('confirmOrder with id type', () => {
    const companyId = 'company-123';
    const confirmRequest: OrderConfirmRequestDto = {
      userId: 'acc-123',
      orderId: 'ord-send-123',
      confirmationCode: '123456',
    };

    const storedOrder = {
      id: 'ord-send-123',
      user_id: 'customer-123',
      reference_id: 'SendABC',
      operation: OperationType.SEND,
      asset: { currency: 'USDC', amount: '10.00' },
    };

    const confirmedResponse: LiriumOrderResponseDto = {
      id: 'ord-send-123',
      operation: 'send',
      state: 'processing',
      asset: { currency: 'USDC', amount: '10.00' },
      send: {
        network: 'polygon',
        destination: { type: 'crypto_currency_address', value: '0xabc123' },
      },
    };

    it('confirms by lirium_id (default)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [storedOrder] })
        .mockResolvedValueOnce({ rows: [] });
      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue(confirmedResponse);

      const result = await service.confirmOrder(confirmRequest, companyId);
      expect(result).toEqual(confirmedResponse);
      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'ord-send-123',
        confirmation_code: '123456',
      });
    });

    it('confirms by reference_id', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ord-send-999' }] })
        .mockResolvedValueOnce({ rows: [{ ...storedOrder, id: 'ord-send-999' }] })
        .mockResolvedValueOnce({ rows: [] });
      (mockLiriumService.confirmOrder as jest.Mock).mockResolvedValue({
        ...confirmedResponse,
        id: 'ord-send-999',
      });

      const result = await service.confirmOrder(
        { ...confirmRequest, orderId: 'SendABC' },
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );

      expect(result.id).toBe('ord-send-999');
      expect(mockLiriumService.confirmOrder).toHaveBeenCalledWith({
        customer_id: 'customer-123',
        order_id: 'ord-send-999',
        confirmation_code: '123456',
      });
    });

    it('throws when reference_id is not found', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        service.confirmOrder(
          { ...confirmRequest, orderId: 'MissingRef' },
          companyId,
          OrderIdentifierType.REFERENCE_ID,
        ),
      ).rejects.toThrow(new NotFoundException('Order with reference id MissingRef not found'));
    });
  });

  describe('state and resend with id type', () => {
    const companyId = 'company-123';

    it('gets order state by reference_id', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ord-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ord-1' }] });
      (mockLiriumService.getOrder as jest.Mock).mockResolvedValue({
        id: 'ord-1',
        operation: 'send',
        state: 'pending',
        asset: { currency: 'USDC', amount: '1.00' },
      });

      const result = await service.getOrderState(
        'SendABC',
        'acc-123',
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );
      expect(result.id).toBe('ord-1');
      expect(mockLiriumService.getOrder).toHaveBeenCalledWith('customer-123', 'ord-1');
    });

    it('resends confirmation code by reference_id', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'customer-123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ord-2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ord-2' }] });

      await service.resendConfirmationCode(
        'SendABC',
        'acc-123',
        companyId,
        OrderIdentifierType.REFERENCE_ID,
      );
      expect(mockLiriumService.resendOrderConfirmationCode).toHaveBeenCalledWith(
        'customer-123',
        'ord-2',
      );
    });
  });

  describe('getSwapQuote hardening', () => {
    it('returns valid quote', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        { currency: 'BTC', bid: '0.00002', ask: '0.000021' },
      ]);

      const result = await service.getSwapQuote({
        asset: { currency: 'USDC', amount: '100' },
        toCurrency: 'BTC',
      });
      expect(result.to.amount).toBe('0.00200000');
    });

    it('throws when source and destination currency are equal', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([]);
      await expect(
        service.getSwapQuote({
          asset: { currency: 'USDC', amount: '100' },
          toCurrency: 'USDC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid currency pair'));
    });

    it('throws when amount is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([]);
      await expect(
        service.getSwapQuote({
          asset: { currency: 'USDC', amount: 'foo' as any },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid amount'));
    });

    it('throws when exchange rate is missing', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([]);
      await expect(
        service.getSwapQuote({
          asset: { currency: 'USDC', amount: '100' },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new NotFoundException('No exchange rate found for USDC -> BTC'));
    });

    it('throws when exchange rate is invalid', async () => {
      (mockLiriumService.getExchangeRates as jest.Mock).mockResolvedValue([
        { currency: 'BTC', bid: 'NaN', ask: '0.000021' },
      ]);
      await expect(
        service.getSwapQuote({
          asset: { currency: 'USDC', amount: '100' },
          toCurrency: 'BTC',
        }),
      ).rejects.toThrow(new BadRequestException('Invalid exchange rate'));
    });
  });
});
