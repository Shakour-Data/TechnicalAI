import { NextRequest, NextResponse } from 'next/server';
import { fetchCandlestick } from '@/lib/tse-api';
import { analyze, type TAResult } from '@/lib/ta-engine';
import type { OHLCV } from '@/lib/ta-engine';
import type { CandleData } from '@/lib/tse-api';

// In-memory storage for analysis results
const analysisResults = new Map<string, any>();

export const dynamic = 'force-dynamic';

interface TimeSeriesRequestBody {
  symbol: string;
  analysis_type?: string;
  horizon?: number;
  mode?: 'quick' | 'detailed';
  model_keys?: string[];
}

/**
 * Transform Python ML analysis result to match frontend expected shape.
 */
function transformMLResult(result: any, mode: 'quick' | 'detailed'): any {
  const mlForecast = result.ml_forecast || result;

  if (mode === 'quick') {
    return {
      status: result.status,
      symbol: result.symbol,
      candles_used: result.candles_used,
      ml_model_used: mlForecast.ml_model_used || 'logistic_regression_vdss',
      training_samples: mlForecast.training_samples || 0,
      features_count: mlForecast.current_features ? Object.keys(mlForecast.current_features).length : 16,
      ml_accuracy: mlForecast.ml_accuracy || 0.5,
      used_native_ml: mlForecast.used_native_ml || false,
      current_features: mlForecast.current_features || {},
      bull_consensus: mlForecast.bull_consensus || 0.5,
      scenarios: mlForecast.scenarios || {},
      forecasts: mlForecast.forecasts || {},
      ensemble: mlForecast.ensemble || {
        model_name: 'Ensemble (VDSS)',
        predictions: [],
        weights: {},
      },
      feature_importance: mlForecast.feature_importance || {},
    };
  } else {
    return {
      status: result.status,
      symbol: result.symbol,
      candles_used: result.candles_used,
      date_range: [
        result.candles_used > 0 ? new Date().toISOString().split('T')[0] : '',
        new Date().toISOString().split('T')[0],
      ],
      forecast: mlForecast,
      decomposition: result.decomposition || {
        trend: [],
        seasonal: [],
        residual: [],
        window: 20,
        method: 'moving_average',
      },
      volatility: result.volatility || {
        annualized_volatility: 0,
        regime: 'low',
        rolling_volatility: [],
        volatility_quantiles: { q33: 0, q66: 0 },
      },
      trend: result.trend || {
        direction: 'neutral',
        strength: 0,
        short_ma: [],
        long_ma: [],
        crossovers: 0,
      },
      seasonality: result.seasonality || {
        has_seasonality: false,
        seasonal_strength: 0,
        period: null,
        method: 'seasonal_decomposition',
      },
      generated_at: result.generated_at,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbol,
      analysis_type = 'time_series',
      horizon = 30,
      mode = 'quick',
      model_keys,
    }: TimeSeriesRequestBody = body;

    if (analysis_type !== 'time_series') {
      return NextResponse.json({ error: 'Only time_series analysis_type supported' }, { status: 400 });
    }

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    // Generate analysis ID
    const analysisId = `analysis_${symbol}_${Date.now()}`;

    // Prepare arguments for Python script
    const scriptPath = require('path').join(process.cwd(), 'api', 'scripts', 'run_ml_predict.py');
    let args = `symbol=${symbol} horizon=${horizon} mode=${mode}`;
    if (model_keys && model_keys.length > 0) {
      args += ` model_keys=${model_keys.join(',')}`;
    }

    // Run Python script synchronously
    let result;
    try {
      const pythonResult = require('child_process').execSync(
        `python "${scriptPath}" analyze ${args}`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      result = JSON.parse(pythonResult.trim());
    } catch (e) {
      return NextResponse.json({ error: 'ML analysis failed' }, { status: 500 });
    }

    // Transform result to match frontend expected shape
    const transformedResult = transformMLResult(result, mode);

    // Store result in memory
    analysisResults.set(analysisId, transformedResult);

    return NextResponse.json({
      ...transformedResult,
      analysis_id: analysisId,
      status: result.status,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[analysis] POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/analysis — Get analysis data for a symbol.
 *
 * @description
 *   Retrieves market data and technical analysis for a given symbol.
 *   Used by the frontend for real-time symbol viewing.
 *
 * @param  req - Next.js request with symbol/indexInsCode query parameters.
 *
 * @returns JSON response:
 *   - **200** `{ candles, ta, info, symbol }` — Market data with TA
 *   - **400** `{ error }` — Missing or invalid symbol
 *   - **500** `{ error }` — Internal server error.
 */
export async function GET(
  req: NextRequest
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const indexInsCode = searchParams.get('indexInsCode');

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    // Fetch candlestick data for the symbol
    let candlesticks: CandleData[];
    try {
      candlesticks = await fetchCandlestick(symbol, 3); // type=3 for adjusted prices
    } catch (fetchError) {
      console.error(`[analysis] Failed to fetch candlesticks for ${symbol}:`, fetchError);
      return NextResponse.json(
        {
          error: `داده‌های تاریخی برای نماد ${symbol} یافت نشد.`,
          symbol,
          candles: [],
          ta: null,
          info: null,
        },
        { status: 404 }
      );
    }

    if (!candlesticks || candlesticks.length === 0) {
      return NextResponse.json(
        {
          error: `داده‌ای برای نماد ${symbol} در دسترس نیست.`,
          symbol,
          candles: [],
          ta: null,
          info: null,
        },
        { status: 404 }
      );
    }

    // Convert to OHLCV format for TA engine
    let ohlcv: OHLCV[];
    try {
      ohlcv = candlesticks.map((c) => ({
        date: c.date,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
      }));
    } catch (mapError) {
      console.error(`[analysis] Failed to map candlesticks for ${symbol}:`, mapError);
      return NextResponse.json(
        {
          error: `خطا در پردازش داده‌های نماد ${symbol}`,
          symbol,
          candles: [],
          ta: null,
          info: null,
        },
        { status: 500 }
      );
    }

    // Run TA analysis
    let ta: TAResult | null = null;
    try {
      ta = analyze(ohlcv, 'واحد');
    } catch (taError) {
      console.error(`[analysis] TA analysis failed for ${symbol}:`, taError);
      // Continue with null ta - we still have candles and info
    }

    // Build info object
    let info: Record<string, unknown> = {};
    try {
      const lastCandle = candlesticks[candlesticks.length - 1]!;
      const prevCandle = candlesticks.length > 1 ? candlesticks[candlesticks.length - 2]! : lastCandle;
      const lastPrice = Number(lastCandle.close);
      const prevPrice = Number(prevCandle.close);
      const change = prevPrice ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;

      info = {
        name: symbol,
        symbol: symbol,
        lastPrice: lastPrice,
        change: change,
        closePrice: lastPrice,
        closeChange: lastPrice - prevPrice,
        openPrice: Number(lastCandle.open),
        minPrice: Number(lastCandle.low),
        maxPrice: Number(lastCandle.high),
        yesterdayClose: prevPrice,
        volume: Number(lastCandle.volume || 0),
        value: 0,
        trades: 0,
        eps: 0,
        pe: 0,
        currencyUnit: 'واحد',
        category: 'stock',
      };
    } catch (infoError) {
      console.error(`[analysis] Failed to build info for ${symbol}:`, infoError);
      info = { symbol, error: 'Failed to build info' };
    }

    // Build response
    const response: Record<string, unknown> = {
      symbol: symbol,
      candles: candlesticks,
      ta: ta || {},
      info: info,
    };

    if (indexInsCode) {
      response.indexInsCode = indexInsCode;
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[analysis] GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
