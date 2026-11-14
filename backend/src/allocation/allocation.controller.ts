import { Controller, Get } from '@nestjs/common';
import { AllocationService } from './allocation.service.js';

@Controller('allocation')
export class AllocationController {
  constructor(
    private readonly allocationService: AllocationService,
  ) {}

  @Get('plan')
  getPlan() {
    return this.allocationService.getPlan();
  }

  @Get('atp')
  getAtp() {
    return this.allocationService.getAtp();
  }
}