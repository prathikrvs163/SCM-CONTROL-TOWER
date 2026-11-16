import { Controller, Get, Query } from '@nestjs/common';

import { AuditService } from './audit.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: ListAuditLogsDto) {
    return this.auditService.findAll(query);
  }
}
