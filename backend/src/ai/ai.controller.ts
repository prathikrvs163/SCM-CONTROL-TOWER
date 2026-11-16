import { Controller, Param, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('exception-summary')
  generateExceptionSummary() {
    return this.aiService.generateExceptionSummary();
  }

  @Post('customer-communication/:orderId')
  generateCustomerCommunication(@Param('orderId') orderId: string) {
    return this.aiService.generateCustomerCommunication(orderId);
  }
}