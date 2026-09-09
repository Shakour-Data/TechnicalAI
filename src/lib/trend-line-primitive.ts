// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════
// Trend Line Drawing Primitive for lightweight-charts v5
// Uses ISeriesPrimitive plugin API for native chart integration
// ═══════════════════════════════════════════════════════════════════

import type {
  Time,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesPrimitive,
  CanvasRenderingTarget2D,
  DrawingUtils,
  ISeriesApi,
  IChartApi,
  SeriesAttachedParameter,
  SeriesType,
} from 'lightweight-charts';

// ── Types ─────────────────────────────────────────────────────────────

export interface TrendLineData {
  time1: Time;
  price1: number;
  time2: Time;
  price2: number;
  color: string;
  lineWidth: number;
  lineStyle: 0 | 1 | 2; // Solid, Dashed, Dotted
}

// ── Renderer (does the actual canvas drawing) ─────────────────────────

class TrendLineRenderer implements IPrimitivePaneRenderer {
  private _x1: number;
  private _y1: number;
  private _x2: number;
  private _y2: number;
  private _color: string;
  private _lineWidth: number;
  private _lineStyle: 0 | 1 | 2;

  constructor(x1: number, y1: number, x2: number, y2: number, data: TrendLineData) {
    this._x1 = x1;
    this._y1 = y1;
    this._x2 = x2;
    this._y2 = y2;
    this._color = data.color;
    this._lineWidth = data.lineWidth;
    this._lineStyle = data.lineStyle;
  }

  draw(target: CanvasRenderingTarget2D, utils?: DrawingUtils): void {
    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;

      ctx.save();

      // Apply line style
      if (utils) {
        utils.setLineStyle(ctx, this._lineStyle);
      } else {
        ctx.setLineDash(this._lineStyle === 1 ? [6, 4] : this._lineStyle === 2 ? [2, 3] : []);
      }

      ctx.strokeStyle = this._color;
      ctx.lineWidth = this._lineWidth;
      ctx.lineCap = 'round';

      // Draw main line
      ctx.beginPath();
      ctx.moveTo(this._x1, this._y1);
      ctx.lineTo(this._x2, this._y2);
      ctx.stroke();

      // Draw endpoint circles
      const radius = Math.max(3, this._lineWidth);
      ctx.fillStyle = this._color;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(this._x1, this._y1, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this._x2, this._y2, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}

// ── Pane View (factory for renderers, called by chart each frame) ────

class TrendLinePaneView implements IPrimitivePaneView {
  private _data: TrendLineData;
  private _series: ISeriesApi<SeriesType, Time> | null = null;

  constructor(data: TrendLineData) {
    this._data = data;
  }

  setSeries(series: ISeriesApi<SeriesType, Time>) {
    this._series = series;
  }

  updateData(data: TrendLineData) {
    this._data = data;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const series = this._series;
    if (!series) return null;

    const x1 = series.timeToCoordinate(this._data.time1);
    const y1 = series.priceToCoordinate(this._data.price1);
    const x2 = series.timeToCoordinate(this._data.time2);
    const y2 = series.priceToCoordinate(this._data.price2);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

    return new TrendLineRenderer(x1, y1, x2, y2, this._data);
  }
}

// ── Series Primitive (manages lifecycle) ──────────────────────────────

class TrendLinePrimitive implements ISeriesPrimitive<Time> {
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _chart: IChartApi | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _data: TrendLineData;
  private _paneView: TrendLinePaneView;

  constructor(data: TrendLineData) {
    this._data = data;
    this._paneView = new TrendLinePaneView(data);
  }

  updateData(data: TrendLineData) {
    this._data = data;
    this._paneView.updateData(data);
    this._requestUpdate?.();
  }

  getData(): TrendLineData {
    return { ...this._data };
  }

  attached(params: SeriesAttachedParameter<Time, SeriesType>): void {
    this._series = params.series;
    this._chart = params.chart;
    this._requestUpdate = params.requestUpdate;
    this._paneView.setSeries(params.series);
  }

  detached(): void {
    this._series = null;
    this._chart = null;
    this._requestUpdate = null;
  }

  updateAllViews(): void {
    // Coordinates are computed fresh in renderer(), so no-op here
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}

// ── Factory & Manager ──────────────────────────────────────────────────

/**
 * Create a new trend line primitive and attach it to a series.
 * Returns the primitive instance for later management.
 */
export function createTrendLine(
  series: ISeriesApi<SeriesType, Time>,
  data: TrendLineData
): TrendLinePrimitive {
  const primitive = new TrendLinePrimitive(data);
  series.attachPrimitive(primitive);
  return primitive;
}

/**
 * Remove a trend line primitive from its series.
 */
export function removeTrendLine(
  series: ISeriesApi<SeriesType, Time>,
  primitive: TrendLinePrimitive
): void {
  series.detachPrimitive(primitive);
}

// ── Color palette for auto-assigning line colors ──────────────────────

export const TREND_LINE_COLORS = [
  '#ffffff',    // White
  '#3ad5db',    // Cyan
  '#ffb11b',    // Gold
  '#a04ac5',    // Purple
  '#ff6b9d',    // Pink
  '#59e39b',    // Green
  '#ff7b32',    // Orange
];

export function getNextLineColor(count: number): string {
  return TREND_LINE_COLORS[count % TREND_LINE_COLORS.length];
}