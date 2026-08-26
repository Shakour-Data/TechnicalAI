import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ML_SERVICE_URL = 'http://localhost:3032';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candles, sessions = 10, models } = body;

    if (!candles || !Array.isArray(candles) || candles.length < 60) {
      return NextResponse.json(
        { error: 'حداقل ۶۰ کندل برای پیش‌بینی ML مورد نیاز است', status: 'error' },
        { status: 400 }
      );
    }

    if (sessions < 1 || sessions > 30) {
      return NextResponse.json(
        { error: 'تعداد جلسات باید بین ۱ تا ۳۰ باشد', status: 'error' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = { candles, sessions: Math.min(sessions, 30) };
    if (models && Array.isArray(models) && models.length > 0) payload.models = models;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const resp = await fetch(`${ML_SERVICE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await resp.json();
      if (!resp.ok) {
        return NextResponse.json({ error: data.error || 'خطا', status: 'error' }, { status: resp.status });
      }
      return NextResponse.json(data);
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'زمان‌برد پیش‌بینی به پایان رسید', status: 'timeout' }, { status: 504 });
      }
      return NextResponse.json(
        { error: 'سرویس پیش‌بینی ML در دسترس نیست.', status: 'service_unavailable' },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error('[ml-predict] Error:', err);
    return NextResponse.json({ error: 'خطای ناشناخته', status: 'error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const resp = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'unavailable', service: 'ml-prediction-service' }, { status: 503 });
  }
}
