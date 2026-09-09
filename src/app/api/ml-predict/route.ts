/**
 * @module API /api/ml-predict
 * @description ML prediction proxy endpoint. Forwards prediction requests to the
 *   Python ML microservice running on localhost:3032 and relays the response back.
 *
 * Supports two methods:
 *   - **POST** — Submit candle data for ML prediction (proxied to port 3032 /api/predict).
 *   - **GET**  — Health check for the ML service (proxied to port 3032 /health).
 */
import { NextRequest, NextResponse } from 'next/server';

/** Force dynamic rendering — never cache at the Next.js edge. */
export const dynamic = 'force-dynamic';

/** Base URL of the Python ML prediction microservice. */
const ML_SERVICE_URL = 'http://localhost:3032';

/**
 * POST /api/ml-predict — Proxy ML prediction request to the Python microservice.
 *
 * @description
 * Processing steps:
 *   1. Parse JSON body — expects `candles` (array), `sessions` (1–30, default 10),
 *      and optional `models` (array of model names).
 *   2. Validate that `candles` has at least 60 entries (minimum for ML models)
 *      and `sessions` is in range 1–30.
 *   3. Forward the request to `http://localhost:3032/api/predict` with a 120-second
 *      AbortController timeout.
 *   4. Relay the ML service response back to the client, or return an appropriate
 *      error if the service is unavailable / times out.
 *
 * @param req - Next.js incoming request with JSON body.
 *
 * @requestBody
 *   - `candles`  {Array} — (required) Array of OHLCV candle objects. Minimum 60 entries.
 *   - `sessions` {number} — Number of prediction sessions (1–30, default 10).
 *   - `models`   {Array}  — (optional) Array of model name strings to use.
 *
 * @returns JSON response:
 *   - **200** — Proxied ML prediction result from the Python service.
 *   - **400** `{ error, status: 'error' }` — Invalid input (too few candles, sessions out of range).
 *   - **503** `{ error, status: 'service_unavailable' }` — ML service unreachable.
 *   - **504** `{ error, status: 'timeout' }` — ML service request exceeded 120s timeout.
 *   - **500** `{ error, status: 'error' }` — Unknown error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Parse request fields: candles (required), sessions (default 10), models (optional)
    const { candles, sessions = 10, models } = body;

    // Validate: minimum 60 candles required for ML models to produce meaningful predictions
    if (!candles || !Array.isArray(candles) || candles.length < 60) {
      return NextResponse.json(
        { error: 'حداقل ۶۰ کندل برای پیش‌بینی ML مورد نیاز است', status: 'error' },
        { status: 400 }
      );
    }

    // Validate: sessions must be in range 1–30
    if (sessions < 1 || sessions > 30) {
      return NextResponse.json(
        { error: 'تعداد جلسات باید بین ۱ تا ۳۰ باشد', status: 'error' },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = { candles, sessions: Math.min(sessions, 30) };
    if (models && Array.isArray(models) && models.length > 0) payload.models = models;

    // Set up 120-second timeout via AbortController for the ML service request
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

/**
 * GET /api/ml-predict — Health check for the ML prediction microservice.
 *
 * @description
 * Proxies a GET request to `http://localhost:3032/health` with a 3-second timeout.
 * Returns the health status JSON from the ML service, or a 503 unavailable response
 * if the service cannot be reached.
 *
 * @returns JSON response:
 *   - **200** — Health status object from the ML service.
 *   - **503** `{ status: 'unavailable', service: 'ml-prediction-service' }` — Service unreachable.
 */
export async function GET() {
  try {
    const resp = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'unavailable', service: 'ml-prediction-service' }, { status: 503 });
  }
}
