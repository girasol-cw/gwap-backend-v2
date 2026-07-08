import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { GetCustomerService } from './get-customer.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { DatabaseService } from 'libs/shared/src/services/database.service';

describe('GetCustomerService', () => {
  let service: GetCustomerService;
  let liriumRequestService: {
    getWallets: jest.Mock;
    getCustomerAccount: jest.Mock;
    getCustomerDetails: jest.Mock;
  };
  let databaseService: { pool: { query: jest.Mock } };

  beforeEach(async () => {
    liriumRequestService = {
      getWallets: jest.fn(),
      getCustomerAccount: jest.fn(),
      getCustomerDetails: jest.fn(),
    };

    databaseService = {
      pool: {
        query: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCustomerService,
        {
          provide: LiriumRequestServiceAbstract,
          useValue: liriumRequestService,
        },
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<GetCustomerService>(GetCustomerService);
  });

  it('returns fully aggregated customer data when all upstream calls succeed', async () => {
    databaseService.pool.query.mockResolvedValue({
      rows: [{ user_id: 'lirium-customer-1', email: 'test@example.com' }],
    });
    liriumRequestService.getWallets.mockResolvedValue({ address: [] });
    liriumRequestService.getCustomerAccount.mockResolvedValue({ accounts: [] });
    liriumRequestService.getCustomerDetails.mockResolvedValue({ id: 'lirium-customer-1' });

    await expect(service.getCustomer('girasol-account-1', 'company-123')).resolves.toEqual({
      id: 'lirium-customer-1',
      accountId: 'girasol-account-1',
      email: 'test@example.com',
      wallets: {
        success: true,
        data: { address: [] },
        error: null,
      },
      accounts: {
        success: true,
        data: { accounts: [] },
        error: null,
      },
      details: {
        success: true,
        data: { id: 'lirium-customer-1' },
        error: null,
      },
      partialSuccess: false,
      failedSources: [],
    });
  });

  it('returns partial success when one upstream call fails', async () => {
    databaseService.pool.query.mockResolvedValue({
      rows: [{ user_id: 'lirium-customer-1', email: 'test@example.com' }],
    });
    liriumRequestService.getWallets.mockResolvedValue({ address: [] });
    liriumRequestService.getCustomerAccount.mockRejectedValue(
      new HttpException('accounts failed', 500),
    );
    liriumRequestService.getCustomerDetails.mockResolvedValue({ id: 'lirium-customer-1' });

    await expect(service.getCustomer('girasol-account-1', 'company-123')).resolves.toEqual({
      id: 'lirium-customer-1',
      accountId: 'girasol-account-1',
      email: 'test@example.com',
      wallets: {
        success: true,
        data: { address: [] },
        error: null,
      },
      accounts: {
        success: false,
        data: null,
        error: {
          source: 'accounts',
          message: 'accounts failed',
          statusCode: 500,
        },
      },
      details: {
        success: true,
        data: { id: 'lirium-customer-1' },
        error: null,
      },
      partialSuccess: true,
      failedSources: ['accounts'],
    });
  });

  it('returns partial success when all upstream calls fail', async () => {
    databaseService.pool.query.mockResolvedValue({
      rows: [{ user_id: 'lirium-customer-1', email: 'test@example.com' }],
    });
    liriumRequestService.getWallets.mockRejectedValue(new Error('wallets failed'));
    liriumRequestService.getCustomerAccount.mockRejectedValue(
      new HttpException('accounts failed', 500),
    );
    liriumRequestService.getCustomerDetails.mockRejectedValue(new Error('details failed'));

    await expect(service.getCustomer('girasol-account-1', 'company-123')).resolves.toEqual({
      id: 'lirium-customer-1',
      accountId: 'girasol-account-1',
      email: 'test@example.com',
      wallets: {
        success: false,
        data: null,
        error: {
          source: 'wallets',
          message: 'wallets failed',
        },
      },
      accounts: {
        success: false,
        data: null,
        error: {
          source: 'accounts',
          message: 'accounts failed',
          statusCode: 500,
        },
      },
      details: {
        success: false,
        data: null,
        error: {
          source: 'details',
          message: 'details failed',
        },
      },
      partialSuccess: true,
      failedSources: ['wallets', 'accounts', 'details'],
    });
  });

  it('throws 404 when the local account mapping does not exist', async () => {
    databaseService.pool.query.mockResolvedValue({ rows: [] });

    await expect(service.getCustomer('missing-account', 'company-123')).rejects.toThrow(
      new NotFoundException('Customer with account id missing-account not found'),
    );
  });
});
