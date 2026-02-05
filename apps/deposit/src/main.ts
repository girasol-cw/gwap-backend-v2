import { NestFactory, Reflector } from '@nestjs/core';
import { DepositModule } from './deposit-listener.module';
import { CompanyIdGuard } from 'libs/shared';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from 'libs/shared/src/fillters/global-exception.filter';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(DepositModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new CompanyIdGuard(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter());
  const config = new DocumentBuilder()
  .setTitle('G.W.A.P Deposit')
  .setDescription('Backend API docs for G.W.A.P Deposit')
  .setVersion('2.0')
  .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
