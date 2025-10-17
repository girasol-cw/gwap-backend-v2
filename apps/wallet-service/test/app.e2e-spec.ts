import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { WalletServiceModule } from './../src/wallet-service.module';

// Set test environment variables
process.env.LIRIUM_API_KEY = 'test-api-key';
process.env.LIRIUM_PRIVATE_KEY_B64 = Buffer.from('test-private-key').toString('base64');

describe('WalletServiceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WalletServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/metrics (GET)', () => {
    return request(app.getHttpServer())
      .get('/metrics')
      .expect(200);
  });
});
