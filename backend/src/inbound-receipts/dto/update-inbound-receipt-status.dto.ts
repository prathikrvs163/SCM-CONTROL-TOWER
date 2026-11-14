import { IsIn } from 'class-validator';

export class UpdateInboundReceiptStatusDto {
  @IsIn(['IN_TRANSIT', 'CANCELED'])
  status!: 'IN_TRANSIT' | 'CANCELED';
}
