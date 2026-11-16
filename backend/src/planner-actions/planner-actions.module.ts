import { Module } from '@nestjs/common';

import { AllocationModule } from '../allocation/allocation.module.js';
import { PlannerActionsController } from './planner-actions.controller.js';
import { PlannerActionsService } from './planner-actions.service.js';

@Module({
  imports: [AllocationModule],
  controllers: [PlannerActionsController],
  providers: [PlannerActionsService],
})
export class PlannerActionsModule {}
