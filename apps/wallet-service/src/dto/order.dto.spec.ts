import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { SwapQuoteRequestDto } from './order.dto';

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
