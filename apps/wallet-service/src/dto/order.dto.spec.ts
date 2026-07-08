import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import {
  OrderConfirmRequestDto,
  OrderRequestDto,
  SwapQuoteRequestDto,
} from './order.dto';

describe('Order DTO validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('rejects deprecated userId in order creation payloads', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: OrderRequestDto,
      data: '',
    };

    await expect(
      pipe.transform(
        {
          accountId: 'acc-123',
          userId: 'legacy-acc-123',
          operation: 'send',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['property userId should not exist'],
      },
    });
  });

  it('rejects deprecated userId in order confirmation payloads', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: OrderConfirmRequestDto,
      data: '',
    };

    await expect(
      pipe.transform(
        {
          accountId: 'acc-123',
          userId: 'legacy-acc-123',
          orderId: 'ord-123',
          confirmationCode: '123456',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['property userId should not exist'],
      },
    });
  });

  it('accepts a valid order confirmation payload', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: OrderConfirmRequestDto,
      data: '',
    };

    await expect(
      pipe.transform(
        {
          accountId: 'acc-123',
          orderId: 'ord-123',
          confirmationCode: '123456',
        },
        metadata,
      ),
    ).resolves.toBeInstanceOf(OrderConfirmRequestDto);
  });
});

describe('SwapQuoteRequestDto validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: SwapQuoteRequestDto,
    data: '',
  };

  it('accepts a valid swap quote payload', async () => {
    await expect(
      pipe.transform(
        {
          asset: {
            currency: 'USDC',
            amount: '10',
          },
          toCurrency: 'BTC',
        },
        metadata,
      ),
    ).resolves.toBeInstanceOf(SwapQuoteRequestDto);
  });

  it('rejects unknown fields', async () => {
    await expect(
      pipe.transform(
        {
          asset: {
            currency: 'USDC',
            amount: '10',
            foo: 'bar',
          },
          toCurrency: 'BTC',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['asset.property foo should not exist'],
      },
    });
  });

  it('rejects missing asset', async () => {
    await expect(
      pipe.transform(
        {
          toCurrency: 'BTC',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['asset should not be null or undefined'],
      },
    });
  });
});
