import { NextResponse } from 'next/server';
import { fetchAllSymbols } from '@/lib/tse-api';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const symbols = await fetchAllSymbols(1);
    return NextResponse.json(symbols);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
