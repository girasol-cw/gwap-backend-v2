import { Controller, HttpStatus, Post } from '@nestjs/common';
import { ListenerService } from './services/listener.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class DepositListenerController {
  constructor(private readonly listenerService: ListenerService) {}

  @Post('listen')
  @ApiOperation({ 
    summary: 'Start deposit listening process',
    description: 'Initiates the deposit listening service to process incoming deposits and execute all necessary steps'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Deposit listening process completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '✅ All steps completed successfully',
          description: 'Status message indicating the result of the listening process'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Deposit listening process failed',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: '❌ Error during listen: Connection timeout',
          description: 'Error message indicating what went wrong during the listening process'
        }
      }
    }
  })
  async listen(): Promise<{ message: string }> {
    try {
      await this.listenerService.listen();
      return { message: '✅ All steps completed successfully' };
    } catch (error: any) {
      return { message: `❌ Error during listen: ${error.message}` };
    }
  }
}
