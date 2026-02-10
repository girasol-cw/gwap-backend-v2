import { NestFactory, Reflector } from '@nestjs/core';
import { WalletServiceModule } from './wallet-service.module';
import { ApiKeyGuard } from './common/api-key-guard';
import { CompanyIdGuard } from 'libs/shared';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from 'libs/shared/src/fillters/global-exception.filter';
import { ValidationPipe } from '@nestjs/common';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(WalletServiceModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(reflector), new CompanyIdGuard(reflector));
  const config = new DocumentBuilder()
    .setTitle('G.W.A.P Wallet Service')
    .setDescription('Backend API docs for G.W.A.P Wallet Service')
    .setVersion('2.0')
    .build();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: false,
    transform: true,
  }));
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

