import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Every planner action must say why it was taken. */
abstract class PlannerReasonDto {
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class ExpediteReceiptDto extends PlannerReasonDto {
  @IsDateString()
  expectedArrivalTime!: string;
}

export class ReassignLineDto extends PlannerReasonDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;
}

export class OverridePromiseDto extends PlannerReasonDto {
  /** A date sets the override; null clears it and restores the computed promise. */
  @ValidateIf((dto: OverridePromiseDto) => dto.promisedShipDate !== null)
  @IsDateString()
  promisedShipDate!: string | null;
}

export class SplitOrderLineDto {
  @IsString()
  @IsNotEmpty()
  orderLineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SplitOrderDto extends PlannerReasonDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitOrderLineDto)
  lines!: SplitOrderLineDto[];
}
