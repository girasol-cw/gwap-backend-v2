import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import FormData = require('form-data');
import { HttpWrapperService } from '../src/services/http-wrapper.service';
import { TokenLiriumServiceAbstract } from '../src/services/token-lirium.service';
import { DatabaseService } from '../src/services/database.service';

describe('HttpWrapperService', () => {
  let service: HttpWrapperService;
  let httpService: { post: jest.Mock };
  let databaseService: { pool: { query: jest.Mock } };
  let tokenService: { getToken: jest.Mock };

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
    };

    databaseService = {
      pool: {
        query: jest.fn(),
      },
    };

    tokenService = {
      getToken: jest.fn().mockResolvedValue({ token: 'token-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpWrapperService,
        {
          provide: HttpService,
          useValue: httpService,
        },
        {
          provide: TokenLiriumServiceAbstract,
          useValue: tokenService,
        },
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<HttpWrapperService>(HttpWrapperService);
  });

  it('stores multipart requests without persisting file contents', async () => {
    const form = new FormData();
    const fileBuffer = Buffer.from('very sensitive file content');

    form.append('document_type', 'id_front');
    form.append('file', fileBuffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf',
    });

    httpService.post.mockReturnValue(
      of({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
    );
    databaseService.pool.query.mockResolvedValue(undefined);

    await service.post('/customers/user-123/documents', form, {
      headers: form.getHeaders(),
    });

    expect(databaseService.pool.query).toHaveBeenCalledTimes(1);
    const savedBody = JSON.parse(databaseService.pool.query.mock.calls[0][1][3]);

    expect(savedBody).toEqual({
      type: 'multipart/form-data',
      headers: expect.objectContaining({
        'content-type': expect.stringContaining('multipart/form-data'),
      }),
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: 'document_type',
          type: 'field',
          value: 'id_front',
        }),
        expect.objectContaining({
          name: 'file',
          type: 'file',
          filename: 'document.pdf',
          contentType: 'application/pdf',
          size: fileBuffer.length,
        }),
      ]),
    });
    expect(JSON.stringify(savedBody)).not.toContain('very sensitive file content');
  });

  it('does not fail the request when request logging cannot be persisted', async () => {
    httpService.post.mockReturnValue(
      of({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
    );
    databaseService.pool.query.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.post('/customers/user-123/documents', { test: true }),
    ).resolves.toEqual(
      expect.objectContaining({
        data: { success: true },
        status: 200,
      }),
    );
  });
});
