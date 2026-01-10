import { NextRequest, NextResponse } from 'next/server';
import { addPayment, getPaymentsByOrderId } from '@/lib/sheets';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const payments = await getPaymentsByOrderId(orderId);
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const data = await request.json();
    const paymentId = await addPayment(orderId, data);
    return NextResponse.json({ paymentId });
  } catch (error) {
    console.error('Error adding payment:', error);
    return NextResponse.json(
      { error: 'Failed to add payment' },
      { status: 500 }
    );
  }
}
