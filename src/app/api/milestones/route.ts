import { NextRequest, NextResponse } from 'next/server';
import { addMilestone } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const milestoneId = await addMilestone(data);
    return NextResponse.json({ milestoneId });
  } catch (error) {
    console.error('Error adding milestone:', error);
    return NextResponse.json(
      { error: 'Failed to add milestone' },
      { status: 500 }
    );
  }
}
