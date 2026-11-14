import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderLineDto } from './create-order-line.dto.js';

export class CreateOrderDto {
  @IsString()
  @Length(3, 100)
  orderNumber: string;

  @IsString()
  @Length(2, 150)
  customerName: string;

  @IsOptional()
  @IsIn(['LOW', 'MED', 'HIGH'])
  priority?: 'LOW' | 'MED' | 'HIGH';

  @IsOptional()
  @IsDateString()
  requestedShipDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];
}
