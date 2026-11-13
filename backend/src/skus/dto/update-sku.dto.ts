import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsBoolean,
} from 'class-validator';

import { Transform } from 'class-transformer';

export class UpdateSkuDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 50)
  skuCode?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}