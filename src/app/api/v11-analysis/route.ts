import { NextRequest, NextResponse } from 'next/server';
import { computeV11Probabilities, buildV11PromptSection, type V11ScenarioInput } from '@/lib/ml-narrative-v11';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenarios = body.scenarios as Record<string, { probability: number }> | undefined;

    if (!scenarios) {
      return NextResponse.json({ error: 'scenarios is required' }, { status: 400 });
    }

    const input: V11ScenarioInput = {
      SC1: scenarios.SC1?.probability ?? 11,
      SC2: scenarios.SC2?.probability ?? 11,
      SC3: scenarios.SC3?.probability ?? 11,
      SC4: scenarios.SC4?.probability ?? 11,
      SC5: scenarios.SC5?.probability ?? 11,
      SC6: scenarios.SC6?.probability ?? 11,
      SC7: scenarios.SC7?.probability ?? 11,
      SC8: scenarios.SC8?.probability ?? 11,
      SC9: scenarios.SC9?.probability ?? 11,
    };

    const v11 = computeV11Probabilities(input);
    const promptSection = buildV11PromptSection(v11);

    return NextResponse.json({
      v11,
      promptSection,
    });
  } catch (err) {
    console.error('[V11 Analysis] error:', err);
    return NextResponse.json({ error: 'خطا در محاسبه احتمالات v11' }, { status: 500 });
  }
}
