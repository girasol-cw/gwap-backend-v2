import { Controller } from '@nestjs/common/decorators/core';
import { AppService } from './app.service';
import { Get } from '@nestjs/common/decorators/http';
import { CompanyId } from 'libs/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(@CompanyId() _companyId: string): string {
    return this.appService.getHello();
  }
}
