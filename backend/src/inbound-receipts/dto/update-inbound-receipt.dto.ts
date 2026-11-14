
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInboundReceiptDto {
  @IsOptional()
  @IsDateString()
  expectedArrivalTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
