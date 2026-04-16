import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from 'libs/shared';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { LiriumWebhookService } from './lirium-webhook.service';

jest.mock('jsonwebtoken');

describe('LiriumWebhookService', () => {
  let service: LiriumWebhookService;
  const mockDatabaseService = {
    pool: {
      query: jest.fn(),
    },
  };

  const eventPayload = {
    id: 'event-123',
    action: 'incoming-funds',
    order: {
      id: 'order-123',
      operation: 'receive',
      state: 'pending',
      customer_id: 'lirium-user-123',
      asset: {
        currency: 'BTC',
        amount: '0.00000365',
      },
      receive: {
        origin: {
          type: 'blockchain_transaction',
          value: 'tx-hash-123',
          amount: '0.000005',
        },
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiriumWebhookService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<LiriumWebhookService>(LiriumWebhookService);
  });

  it('stores an incoming-funds webhook as a deposit row', async () => {
    const rawBody = Buffer.from(JSON.stringify(eventPayload));
    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');

    (jwt.decode as jest.Mock).mockReturnValue({ iss: 'lirium-sandbox' });
    (jwt.verify as jest.Mock).mockReturnValue({
      digest,
      iat: Math.floor(Date.now() / 1000),
      iss: 'lirium-sandbox',
    });

    mockDatabaseService.pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: 'lirium-user-123', company_id: 'company-123' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.handleWebhook('signed-token', rawBody, eventPayload);

    expect(mockDatabaseService.pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT user_id, company_id FROM users WHERE user_id = $1',
      ['lirium-user-123'],
    );

    expect(mockDatabaseService.pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO deposits'),
      [
        'order-123',
        'lirium-user-123',
        '0.00000365',
        false,
        null,
        'company-123',
        'BTC',
        'pending',
        'event-123',
        'blockchain_transaction',
        'tx-hash-123',
        '0.000005',
        eventPayload,
      ],
    );
  });

  it('ignores unrelated webhook actions', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        ...eventPayload,
        action: 'customer-product-changed',
      }),
    );
    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');

    (jwt.decode as jest.Mock).mockReturnValue({ iss: 'lirium-sandbox' });
    (jwt.verify as jest.Mock).mockReturnValue({
      digest,
      iat: Math.floor(Date.now() / 1000),
      iss: 'lirium-sandbox',
    });

    await service.handleWebhook('signed-token', rawBody, {
      ...eventPayload,
      action: 'customer-product-changed',
    });

    expect(mockDatabaseService.pool.query).not.toHaveBeenCalled();
  });

  it('rejects webhook signatures with a wrong digest', async () => {
    const rawBody = Buffer.from(JSON.stringify(eventPayload));

    (jwt.decode as jest.Mock).mockReturnValue({ iss: 'lirium-sandbox' });
    (jwt.verify as jest.Mock).mockReturnValue({
      digest: 'bad-digest',
      iat: Math.floor(Date.now() / 1000),
      iss: 'lirium-sandbox',
    });

    await expect(
      service.handleWebhook('signed-token', rawBody, eventPayload),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('fails when the webhook customer does not exist locally', async () => {
    const rawBody = Buffer.from(JSON.stringify(eventPayload));
    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');

    (jwt.decode as jest.Mock).mockReturnValue({ iss: 'lirium-sandbox' });
    (jwt.verify as jest.Mock).mockReturnValue({
      digest,
      iat: Math.floor(Date.now() / 1000),
      iss: 'lirium-sandbox',
    });

    mockDatabaseService.pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.handleWebhook('signed-token', rawBody, eventPayload),
    ).rejects.toThrow(NotFoundException);
  });
});
