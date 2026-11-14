import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['CONFIRMED', 'FULFILLING', 'SHIPPED', 'CANCELED'])
  status: 'CONFIRMED' | 'FULFILLING' | 'SHIPPED' | 'CANCELED';
}
