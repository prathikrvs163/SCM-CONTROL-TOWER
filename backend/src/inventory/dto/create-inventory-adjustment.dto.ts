import {
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  NotEquals,
} from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  skuId!: string;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 500)
  reason!: string;
}