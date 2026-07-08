import { Test, TestingModule } from '@nestjs/testing';
import { GetWalletsService } from './get-wallets.service';
import { LiriumRequestServiceAbstract } from 'libs/shared/src/interfaces/lirium-request.service.abstract';
import { DatabaseService } from 'libs/shared/src/services/database.service';

describe('GetWalletsService', () => {
  let service: GetWalletsService;
  let liriumRequestService: { getWallets: jest.Mock };
  let databaseService: { pool: { query: jest.Mock } };

  beforeEach(async () => {
    liriumRequestService = {
      getWallets: jest.fn(),
    };

    databaseService = {
      pool: {
        query: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWalletsService,
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

    service = module.get<GetWalletsService>(GetWalletsService);
  });

  it('returns wallet data enriched with the girasol account id and lirium customer id', async () => {
    databaseService.pool.query.mockResolvedValue({
      rows: [{ user_id: 'lirium-customer-1', email: 'test@example.com' }],
    });
    liriumRequestService.getWallets.mockResolvedValue({
      address: [
        {
          address: '0xabc123',
          network: 'polygon',
          currency: 'USDC',
          asset_type: 'crypto',
        },
      ],
    });

    await expect(service.getWallets('girasol-account-1', 'company-123')).resolves.toEqual({
      id: 'lirium-customer-1',
      accountId: 'girasol-account-1',
      email: 'test@example.com',
      address: [
        {
          address: '0xabc123',
          network: 'polygon',
          currency: 'USDC',
          asset_type: 'crypto',
        },
      ],
    });
    expect(liriumRequestService.getWallets).toHaveBeenCalledWith('lirium-customer-1');
  });
});
