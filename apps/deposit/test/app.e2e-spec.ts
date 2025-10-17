import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DepositModule } from '../src/deposit-listener.module';
import { ListenerService } from '../src/services/listener.service';

// Set test environment variables
process.env.LIRIUM_API_KEY = 'test-api-key';
process.env.LIRIUM_PRIVATE_KEY_B64 = Buffer.from('test-private-key').toString('base64');

describe('DepositListenerController (e2e)', () => {
  let app: INestApplication;
  let mockListenerService: any;

  beforeEach(async () => {
    // Mock the ListenerService
    mockListenerService = {
      listen: jest.fn().mockResolvedValue(undefined), // Success case
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DepositModule],
    })
    .overrideProvider(ListenerService)
    .useValue(mockListenerService)
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/listen (POST) - Success', () => {
    return request(app.getHttpServer())
      .post('/listen')
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toContain('All steps completed successfully');
      });
  });

  it('/listen (POST) - Error', async () => {
    // Mock error case
    mockListenerService.listen.mockRejectedValueOnce(new Error('Test error'));

    return request(app.getHttpServer())
      .post('/listen')
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toContain('❌ Error during listen: Test error');
      });
  });
});
