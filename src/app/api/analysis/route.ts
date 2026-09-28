import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

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
    const scriptPath = path.join(process.cwd(), 'api', 'scripts', 'run_ml_predict.py');
    let args = `symbol=${symbol} horizon=${horizon} mode=${mode}`;
    if (model_keys && model_keys.length > 0) {
      args += ` model_keys=${model_keys.join(',')}`;
    }

    // Run Python script synchronously
    let result;
    try {
      const pythonResult = execSync(
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
 * GET /api/analysis/[analysisId] — Get analysis result by ID.
 *
 * @description
 *   Retrieves the result of a previously started analysis.
 *
 * @param  req - Next.js request with analysisId in params.
 *
 * @returns JSON response:
 *   - **200** `{ analysis_id, status: 'completed', result }`
 *   - **404** `{ error: 'Analysis not found' }`
 *   - **500** `{ error }` — Internal server error.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { analysisId: string } }
) {
  try {
    const { analysisId } = params;

    const result = analysisResults.get(analysisId);
    if (!result) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json({
      analysis_id: analysisId,
      status: 'completed',
      result: result,
      created_at: new Date().toISOString(), // Not used by frontend but kept for compatibility
      completed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[analysis] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}