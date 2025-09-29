import { Controller, Post } from '@nestjs/common';
import { ListenerService } from './services/listener.service';

@Controller()
export class DepositListenerController {
  constructor(private readonly listenerService: ListenerService) {}

  @Post('listen')
  async listen(): Promise<{ message: string }> {
    try {
      await this.listenerService.listen();
      return { message: '✅ All steps completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during listen: ${error.message}` };
    }
  }
}
