import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { CompanyIdGuard } from 'libs/shared';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new CompanyIdGuard(reflector));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
