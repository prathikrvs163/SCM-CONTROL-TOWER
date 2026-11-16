import { Body, Controller, Param, Post } from '@nestjs/common';

import { PlannerActionsService } from './planner-actions.service.js';
import {
  ExpediteReceiptDto,
  OverridePromiseDto,
  ReassignLineDto,
  SplitOrderDto,
} from './dto/planner-actions.dto.js';

@Controller('planner-actions')
export class PlannerActionsController {
  constructor(
    private readonly plannerActionsService: PlannerActionsService,
  ) {}

  @Post('receipts/:id/expedite')
  expediteReceipt(
    @Param('id') id: string,
    @Body() dto: ExpediteReceiptDto,
  ) {
    return this.plannerActionsService.expediteReceipt(id, dto);
  }

  @Post('order-lines/:id/reassign')
  reassignLine(@Param('id') id: string, @Body() dto: ReassignLineDto) {
    return this.plannerActionsService.reassignLine(id, dto);
  }

  @Post('order-lines/:id/promise-override')
  overridePromise(
    @Param('id') id: string,
    @Body() dto: OverridePromiseDto,
  ) {
    return this.plannerActionsService.overridePromise(id, dto);
  }

  @Post('orders/:id/split')
  splitOrder(@Param('id') id: string, @Body() dto: SplitOrderDto) {
    return this.plannerActionsService.splitOrder(id, dto);
  }
}
