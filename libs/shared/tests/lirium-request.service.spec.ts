import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LiriumRequestService } from '../src/services/lirium-request.service';
import { HttpWrapperService } from '../src/services/http-wrapper.service';
import { DatabaseService } from '../src/services/database.service';

describe('LiriumRequestService', () => {
  let service: LiriumRequestService;
  let httpService: { get: jest.Mock; post: jest.Mock; put: jest.Mock; patch: jest.Mock };
  let databaseService: { pool: { query: jest.Mock } };
  const request = {
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
  const companyId = 'company-123';

  beforeEach(async () => {
    process.env.LIRIUM_API_URL = 'https://api.lirium.com/v1';

    httpService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
    };

    databaseService = {
      pool: {
        query: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiriumRequestService,
        {
          provide: HttpWrapperService,
          useValue: httpService,
        },
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<LiriumRequestService>(LiriumRequestService);
  });

  describe('getWallets', () => {
    it('returns empty address array when receiving_addresses is missing', async () => {
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
      httpService.get.mockResolvedValue({ data: {} });

      await expect(service.getWallets('customer-123')).resolves.toEqual({
        address: [],
      });
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No receiving addresses returned for customer customer-123'),
      );
    });

    it('maps receiving_addresses array when present', async () => {
      httpService.get.mockResolvedValue({
        data: {
          receiving_addresses: [
            {
              address: '0xabc123',
              network: 'polygon',
              currency: 'USDC',
              asset_type: 'crypto',
            },
          ],
        },
      });

      await expect(service.getWallets('customer-123')).resolves.toEqual({
        address: [
          {
            address: '0xabc123',
            network: 'polygon',
            currency: 'USDC',
            asset_type: 'crypto',
          },
        ],
      });
    });

    it('maps nested data.receiving_addresses array when present', async () => {
      httpService.get.mockResolvedValue({
        data: {
          data: {
            receiving_addresses: [
              {
                address: '0xabc123',
                blockchain: 'polygon',
                asset: 'USDC',
                type: 'crypto',
              },
            ],
          },
        },
      });

      await expect(service.getWallets('customer-123')).resolves.toEqual({
        address: [
          {
            address: '0xabc123',
            network: 'polygon',
            currency: 'USDC',
            asset_type: 'crypto',
          },
        ],
      });
    });
  });

  describe('createCustomer reentrant flow', () => {
    it('creates a remote customer and returns partial success when no wallets are available yet', async () => {
      httpService.post.mockResolvedValue({ data: { id: 'remote-1', type: 'individual' } });
      httpService.get.mockResolvedValue({ data: {} });
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return { rows: [] };
        }
        if (sql.includes('FROM requests')) {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO users')) {
          return { rows: [] };
        }
        if (sql.startsWith('UPDATE users SET status')) {
          return { rows: [] };
        }
        if (sql.includes('FROM wallets')) {
          return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      const result = await service.createCustomer(request as any, companyId);

      expect(result).toEqual({
        accountId: 'remote-1',
        userId: 'remote-1',
        email: 'test@example.com',
        address: [],
        provisionStatus: 'pending_wallet_sync',
      });
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.lirium.com/v1/customers',
        expect.objectContaining({
          reference_id: 'girasol-account-1',
        }),
      );
    });

    it('skips remote update when local customer is ready and request data did not change', async () => {
      httpService.get.mockResolvedValue({
        data: {
          receiving_addresses: [
            {
              address: '0xabc123',
              network: 'polygon',
              currency: 'USDC',
              asset_type: 'crypto',
            },
          ],
        },
      });
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return {
            rows: [
              {
                user_id: 'remote-1',
                company_id: companyId,
                girasol_account_id: request.accountId,
                status: 'ready',
                label: request.label,
                first_name: request.firstName,
                middle_name: request.middleName,
                last_name: request.lastName,
                date_of_birth: request.birthDate,
                national_id_country: request.nationalIdCountryIso2,
                national_id_type: 'national_id',
                national_id: request.nationalId,
                citizenship: request.citizenshipIso2,
                address_line1: request.addressLine1,
                address_line2: request.addressLine2,
                city: request.city,
                state: request.state,
                country: request.countryIso2,
                zip_code: request.zipCode,
                tax_id: request.taxId,
                tax_country: request.taxCountryIso2,
                cellphone: request.cellphone,
                email: request.email,
                customer: { type: 'individual' },
              },
            ],
          };
        }
        if (sql.startsWith('SELECT id FROM wallets')) {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO wallets')) {
          return { rows: [] };
        }
        if (sql.startsWith('UPDATE users SET status')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT deposit_addr AS address')) {
          return {
            rows: [
              {
                address: '0xabc123',
                network: 'polygon',
                currency: 'USDC',
                asset_type: 'crypto',
              },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      const result = await service.createCustomer(request as any, companyId);

      expect(result.provisionStatus).toBe('ready');
      expect(httpService.put).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('skips remote update when persisted optional fields are null and request sends blank strings', async () => {
      httpService.get.mockResolvedValue({
        data: {
          receiving_addresses: [
            {
              address: '0xabc123',
              network: 'polygon',
              currency: 'USDC',
              asset_type: 'crypto',
            },
          ],
        },
      });
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return {
            rows: [
              {
                user_id: 'remote-1',
                company_id: companyId,
                girasol_account_id: request.accountId,
                status: 'ready',
                label: request.label,
                first_name: request.firstName,
                middle_name: null,
                last_name: request.lastName,
                date_of_birth: request.birthDate,
                national_id_country: request.nationalIdCountryIso2,
                national_id_type: 'national_id',
                national_id: request.nationalId,
                citizenship: request.citizenshipIso2,
                address_line1: request.addressLine1,
                address_line2: null,
                city: request.city,
                state: request.state,
                country: request.countryIso2,
                zip_code: request.zipCode,
                tax_id: request.taxId,
                tax_country: request.taxCountryIso2,
                cellphone: request.cellphone,
                email: request.email,
                customer: { type: 'individual' },
              },
            ],
          };
        }
        if (sql.startsWith('SELECT id FROM wallets')) {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO wallets')) {
          return { rows: [] };
        }
        if (sql.startsWith('UPDATE users SET status')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT deposit_addr AS address')) {
          return {
            rows: [
              {
                address: '0xabc123',
                network: 'polygon',
                currency: 'USDC',
                asset_type: 'crypto',
              },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      const result = await service.createCustomer(request as any, companyId);

      expect(result.provisionStatus).toBe('ready');
      expect(httpService.put).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('updates the remote customer when local data changed and then completes wallet sync', async () => {
      httpService.put.mockResolvedValue({ data: { id: 'remote-1', type: 'individual' } });
      httpService.get.mockResolvedValue({
        data: {
          receiving_addresses: [
            {
              address: '0xabc123',
              network: 'polygon',
              currency: 'USDC',
              asset_type: 'crypto',
            },
          ],
        },
      });
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return {
            rows: [
              {
                user_id: 'remote-1',
                company_id: companyId,
                girasol_account_id: request.accountId,
                status: 'pending_wallet_sync',
                label: request.label,
                first_name: request.firstName,
                middle_name: request.middleName,
                last_name: request.lastName,
                date_of_birth: request.birthDate,
                national_id_country: request.nationalIdCountryIso2,
                national_id_type: 'national_id',
                national_id: request.nationalId,
                citizenship: request.citizenshipIso2,
                address_line1: request.addressLine1,
                address_line2: request.addressLine2,
                city: request.city,
                state: request.state,
                country: request.countryIso2,
                zip_code: request.zipCode,
                tax_id: request.taxId,
                tax_country: request.taxCountryIso2,
                cellphone: request.cellphone,
                email: 'old@example.com',
                customer: { type: 'individual' },
              },
            ],
          };
        }
        if (sql.startsWith('UPDATE users')) {
          return { rows: [] };
        }
        if (sql.startsWith('SELECT id FROM wallets')) {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO wallets')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT deposit_addr AS address')) {
          return {
            rows: [
              {
                address: '0xabc123',
                network: 'polygon',
                currency: 'USDC',
                asset_type: 'crypto',
              },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      const result = await service.createCustomer(request as any, companyId);

      expect(result.provisionStatus).toBe('ready');
      expect(httpService.put).toHaveBeenCalledWith(
        'https://api.lirium.com/v1/customers/remote-1',
        expect.objectContaining({
          reference_id: 'girasol-account-1',
        }),
      );
    });

    it('relinks from request logs when remote customer exists but local row is missing', async () => {
      const loggerLogSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
      httpService.put.mockRejectedValue(new HttpException('Method not allowed', 405));
      httpService.patch.mockResolvedValue({ data: { id: 'remote-1', type: 'individual' } });
      httpService.get.mockResolvedValue({ data: {} });
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return { rows: [] };
        }
        if (sql.includes('FROM requests')) {
          return {
            rows: [{ response_body: { id: 'remote-1', type: 'individual' } }],
          };
        }
        if (sql.startsWith('INSERT INTO users')) {
          return { rows: [] };
        }
        if (sql.startsWith('UPDATE users SET status')) {
          return { rows: [] };
        }
        if (sql.includes('FROM wallets')) {
          return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      const result = await service.createCustomer(request as any, companyId);

      expect(result.provisionStatus).toBe('pending_wallet_sync');
      expect(httpService.post).not.toHaveBeenCalled();
      expect(httpService.put).toHaveBeenCalledWith(
        'https://api.lirium.com/v1/customers/remote-1',
        expect.any(Object),
      );
      expect(httpService.patch).toHaveBeenCalledWith(
        'https://api.lirium.com/v1/customers/remote-1',
        expect.any(Object),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'PUT /customers/remote-1 returned 405, retrying with PATCH',
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lirium customer update via PATCH succeeded:'),
      );
    });

    it('fails the whole request when the remote update fails', async () => {
      httpService.put.mockRejectedValue(new Error('remote update failed'));
      databaseService.pool.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM users WHERE girasol_account_id')) {
          return {
            rows: [
              {
                user_id: 'remote-1',
                company_id: companyId,
                girasol_account_id: request.accountId,
                status: 'ready',
                label: request.label,
                first_name: request.firstName,
                middle_name: request.middleName,
                last_name: request.lastName,
                date_of_birth: request.birthDate,
                national_id_country: request.nationalIdCountryIso2,
                national_id_type: 'national_id',
                national_id: request.nationalId,
                citizenship: request.citizenshipIso2,
                address_line1: request.addressLine1,
                address_line2: request.addressLine2,
                city: request.city,
                state: request.state,
                country: request.countryIso2,
                zip_code: request.zipCode,
                tax_id: request.taxId,
                tax_country: request.taxCountryIso2,
                cellphone: request.cellphone,
                email: 'old@example.com',
                customer: { type: 'individual' },
              },
            ],
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      });

      await expect(service.createCustomer(request as any, companyId)).rejects.toThrow(
        'remote update failed',
      );
    });
  });
});
