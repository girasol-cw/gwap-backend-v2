import { NestFactory, Reflector } from '@nestjs/core';
import { WalletServiceModule } from './wallet-service.module';
import { ApiKeyGuard } from './common/api-key-guard';
import * as dotenv from 'dotenv';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from 'libs/shared/src/fillters/global-exception.filter';
import { ValidationPipe } from '@nestjs/common';

// Cargar variables de entorno
dotenv.config();


async function bootstrap() {
  const app = await NestFactory.create(WalletServiceModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ApiKeyGuard(reflector));
  const config = new DocumentBuilder()
    .setTitle('G.W.A.P Wallet Service')
    .setDescription('Backend API docs for G.W.A.P Wallet Service')
    .setVersion('2.0')
    .build();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

