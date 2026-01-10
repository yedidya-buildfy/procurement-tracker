import { NextRequest, NextResponse } from 'next/server';
import { addCost, getCostsByOrderId } from '@/lib/sheets';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const costs = await getCostsByOrderId(orderId);
    return NextResponse.json(costs);
  } catch (error) {
    console.error('Error fetching costs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs' },
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
    const costId = await addCost(orderId, data);
    return NextResponse.json({ costId });
  } catch (error) {
    console.error('Error adding cost:', error);
    return NextResponse.json(
      { error: 'Failed to add cost' },
      { status: 500 }
    );
  }
}
