import { NestFactory } from '@nestjs/core';
import { DepositModule } from './deposit-listener.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(DepositModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
