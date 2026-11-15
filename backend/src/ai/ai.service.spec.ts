import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service.js';
import { ExceptionsService } from '../exceptions/exceptions.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { AllocationService } from '../allocation/allocation.service.js';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
  AiService,
  {
    provide: ConfigService,
    useValue: { get: () => undefined },
  },
  {
    provide: ExceptionsService,
    useValue: { findAll: () => undefined },
  },
  {
    provide: OrdersService,
    useValue: { findOne: () => undefined },
  },
  {
    provide: AllocationService,
    useValue: { getPlan: () => undefined },
  },
],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});