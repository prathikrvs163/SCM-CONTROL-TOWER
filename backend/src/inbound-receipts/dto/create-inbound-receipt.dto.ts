
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateInboundReceiptDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  receiptId!: string;

  @IsString()
  @IsNotEmpty()
  skuId!: string;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsDateString()
  expectedArrivalTime!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
