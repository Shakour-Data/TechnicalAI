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
      R1: scenarios.R1?.probability ?? 20,
      R2: scenarios.R2?.probability ?? 20,
      R3: scenarios.R3?.probability ?? 20,
      R4: scenarios.R4?.probability ?? 20,
      R5: scenarios.R5?.probability ?? 20,
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
