import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const AUDIT_ENTITY_TYPES = [
  'INBOUND_RECEIPT',
  'ORDER',
  'AI_INTERACTION',
] as const;

export class ListAuditLogsDto {
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: (typeof AUDIT_ENTITY_TYPES)[number];

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
