import { NextRequest, NextResponse } from 'next/server';
import { updateCost, deleteCost, updateCostProductLinks } from '@/lib/sheets';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ costId: string }> }
) {
  try {
    const { costId } = await params;
    const { linkedProductIds, ...updates } = await request.json();

    const success = await updateCost(costId, updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Cost not found' },
        { status: 404 }
      );
    }

    // Update linked products if provided
    if (linkedProductIds) {
      await updateCostProductLinks(costId, linkedProductIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating cost:', error);
    return NextResponse.json(
      { error: 'Failed to update cost' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ costId: string }> }
) {
  try {
    const { costId } = await params;
    const success = await deleteCost(costId);

    if (!success) {
      return NextResponse.json(
        { error: 'Cost not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cost:', error);
    return NextResponse.json(
      { error: 'Failed to delete cost' },
      { status: 500 }
    );
  }
}
