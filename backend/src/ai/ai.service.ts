import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { ExceptionsService } from '../exceptions/exceptions.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { AllocationService } from '../allocation/allocation.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly exceptionsService: ExceptionsService,
    private readonly ordersService: OrdersService,
    private readonly allocationService: AllocationService,
  ) {}

  private async generateText(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model =
      this.configService.get<string>('GEMINI_MODEL') ??
      'gemini-3.8-flash';

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Gemini API key is not configured',
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a supply chain operations assistant. ' +
            'Use only the supplied data. Never invent inventory, quantities, ' +
            'delivery dates, or commitments. Clearly distinguish facts from recommendations.',
        },
      });

      const text = response.text?.trim();

      if (!text) {
        throw new InternalServerErrorException(
          'The AI provider returned an empty response',
        );
      }

      return text;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Unable to generate AI response. Check Gemini API configuration and availability.',
      );
    }
  }

  async generateExceptionSummary() {
    const result = await this.exceptionsService.findAll();

    const prompt = `
Analyze this live supply-chain exception data.

Exception data:
${JSON.stringify(result, null, 2)}

Produce an operational summary with these sections:

1. Overall situation
2. Most critical exceptions
3. Orders and customers at risk
4. Supply or inventory constraints
5. Recommended planner actions

Use actual order numbers and quantities from the data.
Prioritize HIGH severity, then MEDIUM, then LOW.
If there are no exceptions, clearly state that.
Do not invent facts or promise dates.
Keep the response concise and useful to a supply-chain planner.
`;

    const summary = await this.generateText(prompt);

    return {
      generatedAt: new Date(),
      exceptionCount: result.totalExceptions,
      summary,
    };
  }

  async generateCustomerCommunication(orderId: string) {
    const order = await this.ordersService.findOne(orderId);
    const plan = await this.allocationService.getPlan();

    const allocation = plan.orders.find(
      (item) => item.orderId === orderId,
    );

    const allExceptions = await this.exceptionsService.findAll();

    const orderExceptions = allExceptions.exceptions.filter(
      (item) => item.orderId === orderId,
    );

    const prompt = `
Draft a professional customer-facing order update.

Order information:
${JSON.stringify(order, null, 2)}

Current allocation information:
${JSON.stringify(allocation ?? null, null, 2)}

Current exceptions:
${JSON.stringify(orderExceptions, null, 2)}

Requirements:
- Address the customer professionally.
- Explain the fulfillment situation in clear, simple language.
- Mention shortages or delays only when supported by the supplied data.
- Do not expose internal severity classifications or technical allocation terminology.
- Never invent a delivery date or shipping commitment.
- IMPORTANT: An inbound receipt's expected arrival date is NOT a confirmed order shipping date.
- If inventory is expected to arrive on a particular date, describe it only as an expected inventory arrival.
- Never present allocation.promisedShipDate as a guaranteed customer shipping date.
- If the promised ship date is null, do not suggest a specific date.
- Do not claim an order has shipped unless its status is SHIPPED.
- Do not claim there are no delays unless the supplied data establishes that.
- Include a suitable subject line and message body.
- Keep the message concise and empathetic.

Return only the customer communication draft.
`;

    const draft = await this.generateText(prompt);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      generatedAt: new Date(),
      draft,
    };
  }
}