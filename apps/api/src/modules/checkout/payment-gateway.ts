export interface PaymentRequest {
  orderId: string;
  amountIdr: number;
  // Only the mock reads this; a real gateway decides the outcome itself.
  simulate?: 'success' | 'fail';
}

export type PaymentResult =
  | { status: 'succeeded'; providerRef: string }
  | { status: 'failed'; reason: string };

// A Midtrans or Xendit adapter implements this later without touching the service.
export interface PaymentGateway {
  readonly name: string;
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';

  async charge({ orderId, simulate }: PaymentRequest): Promise<PaymentResult> {
    if (simulate === 'fail') {
      return { status: 'failed', reason: 'The payment was declined (simulated).' };
    }
    return { status: 'succeeded', providerRef: `mock_${orderId}` };
  }
}
