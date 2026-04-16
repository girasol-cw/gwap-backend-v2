import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { DatabaseService } from 'libs/shared';
import { DepositForwarderService } from './deposit-forwarder.service';

jest.mock('axios');

describe('DepositForwarderService', () => {
  let service: DepositForwarderService;
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mockDatabaseService = {
    pool: {
      connect: jest.fn(),
      query: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.SEND_URL = 'https://example.com/deposits';
    process.env.GIRASOL_API_KEY = 'api-key';
    process.env.GIRASOL_SECRET_KEY = 'secret-key';
    (axios as any).isAxiosError = jest.fn();

    mockDatabaseService.pool.connect.mockResolvedValue(client);
    client.query.mockReset();
    client.release.mockReset();
    mockDatabaseService.pool.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositForwarderService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<DepositForwarderService>(DepositForwarderService);
  });

  it('forwards a pending deposit and marks it as sent', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          {
            orderId: 'order-123',
            companyId: 'company-123',
            amount: '12.34',
            currency: 'BTC',
            txHash: 'tx-hash-123',
            fees: '0.00000135',
            email: 'test@example.com',
            account: 'account-123',
          },
        ],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    (axios.post as jest.Mock).mockResolvedValue({
      status: 201,
      data: { ok: true },
    });

    mockDatabaseService.pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.forwardDeposit('order-123');

    expect(result).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      'https://example.com/deposits',
      expect.objectContaining({
        txHash: 'tx-hash-123',
        orderId: 'order-123',
        email: 'test@example.com',
        account: 'account-123',
        amount: 12.34,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'api-key',
          'x-secret-key': 'secret-key',
          'x-company-id': 'company-123',
        }),
      }),
    );
    expect(mockDatabaseService.pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET forward_status = 'sent'"),
      ['order-123', { ok: true }],
    );
  });

  it('marks the deposit as sent when upstream reports a duplicate txHash', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          {
            orderId: 'order-123',
            companyId: 'company-123',
            amount: '12.34',
            currency: 'BTC',
            txHash: 'tx-hash-123',
            fees: null,
            email: 'test@example.com',
            account: 'account-123',
          },
        ],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    (axios as any).isAxiosError.mockReturnValue(true);
    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        status: 409,
        data: {
          data: 'Transaction with this txHash already exists',
        },
      },
      message: 'Conflict',
    });

    mockDatabaseService.pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.forwardDeposit('order-123');

    expect(result).toBe(true);
    expect(mockDatabaseService.pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET forward_status = 'sent'"),
      ['order-123', { data: 'Transaction with this txHash already exists' }],
    );
  });

  it('does nothing when the deposit is already sent or being processed', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(undefined);

    const result = await service.forwardDeposit('order-123');

    expect(result).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
    expect(mockDatabaseService.pool.query).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalled();
  });

  it('marks the deposit as failed when upstream returns a non-idempotent error', async () => {
    client.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          {
            orderId: 'order-123',
            companyId: 'company-123',
            amount: '12.34',
            currency: 'BTC',
            txHash: 'tx-hash-123',
            fees: null,
            email: 'test@example.com',
            account: 'account-123',
          },
        ],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    (axios as any).isAxiosError.mockReturnValue(true);
    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
        },
      },
      message: 'Unprocessable Entity',
    });

    const result = await service.forwardDeposit('order-123');

    expect(result).toBe(false);
    expect(mockDatabaseService.pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET forward_status = 'failed'"),
      ['order-123', 'HTTP 422: {"message":"Validation failed"}'],
    );
  });
});
