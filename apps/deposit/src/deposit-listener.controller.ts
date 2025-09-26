import { Controller, Get } from '@nestjs/common';
import { LiriumRequestServiceAbstract } from 'libs/shared';

@Controller()
export class DepositListenerController {
  constructor(private readonly liriumService: LiriumRequestServiceAbstract) {}

  @Get()
  async listen(): Promise<{ message: string }> {
    try {
      // first we have to get all the customers from the database
      await this.liriumService.getCustomerAccount('123');
      return { message: '✅ All steps completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during listen: ${error.message}` };
    }
  }
}
