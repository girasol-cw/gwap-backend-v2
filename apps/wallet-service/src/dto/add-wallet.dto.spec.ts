import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { AddWalletRequestDto } from './add-wallet.dto';

describe('AddWalletRequestDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: AddWalletRequestDto,
    data: '',
  };

  const buildPayload = () => ({
    userType: 'individual',
    email: 'test@example.com',
    accountId: 'acc-123',
    firstName: 'Sebastian',
    lastName: 'Ortiz',
    birthDate: '1995-01-01',
    nationalIdCountryIso2: 'CO',
    nationalIdType: 'national_id',
    nationalId: '123456789',
    citizenshipIso2: 'CO',
    addressLine1: 'Street 123',
    city: 'Medellin',
    state: 'Antioquia',
    countryIso2: 'CO',
    zipCode: '050001',
    cellphone: '+573001112233',
  });

  it('normalizes cedula into the Lirium national_id value', async () => {
    await expect(
      pipe.transform(
        {
          ...buildPayload(),
          nationalIdType: 'cedula',
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      nationalIdType: 'national_id',
    });
  });

  it('rejects deprecated userId in favor of accountId', async () => {
    await expect(
      pipe.transform(
        {
          ...buildPayload(),
          userId: 'legacy-acc-123',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['property userId should not exist'],
      },
    });
  });

  it('rejects unsupported nationalIdType values', async () => {
    await expect(
      pipe.transform(
        {
          ...buildPayload(),
          nationalIdType: 'cedula_extranjera',
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: ['nationalIdType must be one of the following values: passport, driver_license, national_id'],
      },
    });
  });

  it('requires accountId', async () => {
    await expect(
      pipe.transform(
        {
          ...buildPayload(),
          accountId: undefined,
        },
        metadata,
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'accountId should not be empty',
          'accountId must be a string',
        ]),
      },
    });
  });
});
