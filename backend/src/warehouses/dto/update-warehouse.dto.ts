
import {
  IsOptional,
  IsString,
  Length,
  IsBoolean,
} from 'class-validator';

import { Transform } from 'class-transformer';

export class UpdateWarehouseDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 20)
  code?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  city?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
