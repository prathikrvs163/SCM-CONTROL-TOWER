import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service.js';

@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get()
  findAll(
    @Query('severity') severity?: string,
    @Query('type') type?: string,
  ) {
    if (severity && !['HIGH', 'MEDIUM', 'LOW'].includes(severity)) {
      throw new BadRequestException(
        'Severity must be HIGH, MEDIUM, or LOW',
      );
    }

    if (
      type &&
      !['BACKORDER', 'LATE_PROMISE', 'INBOUND_DEPENDENCY'].includes(type)
    ) {
      throw new BadRequestException('Invalid exception type');
    }

    return this.exceptionsService.findAll({
      severity,
      type,
    });
  }
}
