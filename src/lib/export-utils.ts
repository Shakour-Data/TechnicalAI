import type { IChartApi } from 'lightweight-charts';
import { toShamsi } from '@/lib/jalali';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface ExportData {
  symbolName: string;
  instrumentLabel: string;
  candles: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  currentPrice: number;
  unit: string;
  // Indicators
  rsi: number; mfi: number; cci: number; adx: number;
  stochK: number; stochD: number;
  macdLine: number; macdSignal: number; macdHist: number;
  diPlus: number; diMinus: number; sar: number; atr: number;
  obv: number; hasVolume: boolean;
  bollingerUpper: number; bollingerMiddle: number; bollingerLower: number;
  trendDirection: string; trendAngle: number; trendR2: number;
  overallSignal: string;
  ma21: number; ma100: number;
  // S/R
  resistances: number[];
  supports: number[];
  resistanceStrengths: { price: number; strength: number; isTarget: boolean; grade?: string }[];
  supportStrengths: { price: number; strength: number; isTarget: boolean; grade?: string }[];
  // Scenarios
  scenarios: Record<string, { name: string; probability: number; targetMin: number; targetMax: number; description: string }>;
  // Analysis text
  aiAnalysis: string | null;
  // Chart ref for screenshot
  chartApi: IChartApi | null;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function computeSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period) return closes.map(() => null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i > period - 1) sum += closes[i] - closes[i - period];
    result.push(Math.round(sum / period));
  }
  return result;
}

function toEn(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// ═══════════════════════════════════════════════════════════════════
// 1. HTML + CSS + JS (self-contained with interactive chart)
// ═══════════════════════════════════════════════════════════════════

export function exportHTML(data: ExportData) {
  const { symbolName, instrumentLabel, candles, currentPrice, unit,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    resistances, supports, resistanceStrengths, supportStrengths,
    scenarios, aiAnalysis } = data;

  const dateStr = toShamsi(new Date(), 'long');
  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);

  const closes = candles.map(c => c.close);
  const ma21Arr = computeSMA(closes, 21);
  const ma100Arr = computeSMA(closes, 100);

  // Build candle data JSON for the chart
  const candleJson = JSON.stringify(candles);
  const supportJson = JSON.stringify(supportStrengths.filter(s => s.price > 0));
  const resistanceJson = JSON.stringify(resistanceStrengths.filter(r => r.price > 0));

  const scenariosHtml = Object.entries(scenarios)
    .sort((a, b) => b[1].probability - a[1].probability)
    .map(([key, s]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;">${s.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;"><span style="background:${s.probability > 30 ? '#dcfce7' : s.probability > 15 ? '#fef9c3' : '#fee2e2'};padding:2px 10px;border-radius:12px;font-weight:bold;">${s.probability}٪</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:left;direction:ltr;">${toEn(s.targetMin)} — ${toEn(s.targetMax)}</td>
      </tr>`)
    .join('');

  const supportsHtml = supportStrengths.filter(s => s.price > 0).map((s, i) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0fdf4;"><span>حمایت ${i + 1} <small style="color:#6b7280;">(${s.grade || '—'})</small></span><span style="font-weight:bold;color:#16a34a;direction:ltr;">${toEn(s.price)} ${unit}</span></div>`
  ).join('');

  const resistancesHtml = resistanceStrengths.filter(r => r.price > 0).map((r, i) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fef2f2;"><span>مقاومت ${i + 1} <small style="color:#6b7280;">(${r.grade || '—'})</small></span><span style="font-weight:bold;color:#dc2626;direction:ltr;">${toEn(r.price)} ${unit}</span></div>`
  ).join('');

  const analysisHtml = aiAnalysis
    ? `<div style="margin-top:24px;padding:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;line-height:2;white-space:pre-wrap;font-size:14px;color:#1f2937;">${aiAnalysis.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تحلیل تکنیکال ${instrumentLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f9fafb; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 20px; direction: rtl; }
  .container { max-width: 960px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
  .header { background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 24px 28px; border-bottom: 2px solid #f59e0b; }
  .header h1 { font-size: 20px; color: #92400e; margin-bottom: 8px; }
  .header .meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #78716c; }
  .header .meta span { background: white; padding: 4px 12px; border-radius: 20px; border: 1px solid #e5e7eb; }
  .header .meta b { color: #1f2937; }
  .chart-section { padding: 20px; }
  #chart-container { width: 100%; height: 500px; border-radius: 12px; border: 1px solid #e5e7eb; }
  .section { padding: 20px 28px; }
  .section h2 { font-size: 15px; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  .indicators-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .ind-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; text-align: center; }
  .ind-item .label { font-size: 10px; color: #6b7280; margin-bottom: 2px; }
  .ind-item .value { font-size: 16px; font-weight: bold; color: #111827; direction: ltr; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table th { background: #f9fafb; padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 16px; border-top: 1px solid #f3f4f6; background: #f9fafb; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📈 تحلیل تکنیکال ${instrumentLabel}</h1>
    <div class="meta">
      <span>📍 قیمت: <b>${toEn(currentPrice)} ${unit}</b></span>
      <span>📊 روند: <b>${trendLabel}</b> (R²=${r2Pct}٪)</span>
      <span>📅 تاریخ: <b>${dateStr}</b></span>
      <span>🎯 سیگنال: <b>${overallSignal === 'bullish' ? 'صعودی' : overallSignal === 'bearish' ? 'نزولی' : 'خنثی'}</b></span>
    </div>
  </div>

  <div class="chart-section">
    <div id="chart-container"></div>
  </div>

  <div class="section">
    <h2>📊 اندیکاتورها</h2>
    <div class="indicators-grid">
      <div class="ind-item"><div class="label">RSI</div><div class="value" style="color:${rsi > 70 ? '#dc2626' : rsi < 30 ? '#16a34a' : '#374151'}">${rsi.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">MFI</div><div class="value">${mfi.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">CCI</div><div class="value">${cci.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">ADX</div><div class="value">${adx.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">Stoch K/D</div><div class="value">${stochK.toFixed(1)} / ${stochD.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">MACD</div><div class="value">${macdLine.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">MACD Signal</div><div class="value">${macdSignal.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">ATR</div><div class="value">${atr.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">SAR</div><div class="value">${toEn(sar)}</div></div>
      <div class="ind-item"><div class="label">DI+/DI-</div><div class="value">${diPlus.toFixed(1)} / ${diMinus.toFixed(1)}</div></div>
      <div class="ind-item"><div class="label">BB بالا</div><div class="value">${toEn(bollingerUpper)}</div></div>
      <div class="ind-item"><div class="label">BB پایین</div><div class="value">${toEn(bollingerLower)}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>🎯 سناریوها</h2>
    <table>
      <thead><tr><th>سناریو</th><th style="text-align:center;">احتمال</th><th style="text-align:right;">محدوده هدف</th></tr></thead>
      <tbody>${scenariosHtml}</tbody>
    </table>
  </div>

  <div class="section grid-2">
    <div>
      <h2 style="color:#16a34a;">🛡️ سطوح حمایت</h2>
      ${supportsHtml || '<p style="color:#9ca3af;font-size:13px;">سطح حمایتی شناسایی نشد</p>'}
    </div>
    <div>
      <h2 style="color:#dc2626;">⚠️ سطوح مقاومت</h2>
      ${resistancesHtml || '<p style="color:#9ca3af;font-size:13px;">سطح مقاومتی شناسایی نشد</p>'}
    </div>
  </div>

  ${analysisHtml}

  <div class="footer">
    تاریخ تهیه: ${dateStr} — صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری نیست.
  </div>
</div>

<script src="https://unpkg.com/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js"></script>
<script>
(function() {
  var candles = ${candleJson};
  var supports = ${supportJson};
  var resistances = ${resistanceJson};
  var container = document.getElementById('chart-container');
  if (!container || candles.length === 0) return;

  var chart = LightweightCharts.createChart(container, {
    layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#6b7280', fontSize: 11 },
    grid: { vertLines: { color: 'rgba(0,0,0,0.06)' }, horzLines: { color: 'rgba(0,0,0,0.06)' } },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: '#e5e7eb', scaleMargins: { top: 0.05, bottom: 0.25 } },
    timeScale: { borderColor: '#e5e7eb', rightOffset: 5, barSpacing: 7 },
    width: container.clientWidth,
    height: container.clientHeight
  });

  var candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#34c98b', downColor: '#ef4d62', borderUpColor: '#34c98b', borderDownColor: '#ef4d62',
    wickUpColor: '#34c98b', wickDownColor: '#ef4d62'
  });
  candleSeries.setData(candles.map(function(c, i) {
    return { time: c.date || i, open: c.open, high: c.high, low: c.low, close: c.close };
  }));

  var volSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: 'volume' }, priceScaleId: 'vol'
  });
  volSeries.setData(candles.map(function(c, i) {
    return { time: c.date || i, value: c.volume, color: c.close >= c.open ? 'rgba(52,201,139,0.25)' : 'rgba(239,77,98,0.25)' };
  }));
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

  // MA21
  var closes = candles.map(function(c) { return c.close; });
  function calcSMA(data, period) {
    var r = [];
    if (data.length < period) return data.map(function() { return null; });
    var sum = 0;
    for (var i = 0; i < period; i++) sum += data[i];
    for (var i = 0; i < data.length; i++) {
      if (i < period - 1) { r.push(null); continue; }
      if (i > period - 1) sum += data[i] - data[i - period];
      r.push(sum / period);
    }
    return r;
  }
  var ma21Data = calcSMA(closes, 21);
  var ma100Data = calcSMA(closes, 100);
  var ma21Series = chart.addSeries(LightweightCharts.LineSeries, { color: '#3ad5db', lineWidth: 2, title: 'MA21' });
  var ma21LineData = [];
  ma21Data.forEach(function(v, i) { if (v !== null) ma21LineData.push({ time: candles[i].date || i, value: v }); });
  ma21Series.setData(ma21LineData);
  var ma100Series = chart.addSeries(LightweightCharts.LineSeries, { color: '#a04ac5', lineWidth: 2, title: 'MA100' });
  var ma100LineData = [];
  ma100Data.forEach(function(v, i) { if (v !== null) ma100LineData.push({ time: candles[i].date || i, value: v }); });
  ma100Series.setData(ma100LineData);

  // Support lines
  supports.forEach(function(s, i) {
    candleSeries.createPriceLine({ price: s.price, color: '#34c98b', lineWidth: s.isTarget ? 3 : 1, lineStyle: s.isTarget ? 0 : 2, title: 'S' + (i+1), axisLabelVisible: i < 6 });
  });
  // Resistance lines
  resistances.forEach(function(r, i) {
    candleSeries.createPriceLine({ price: r.price, color: '#ef4d62', lineWidth: r.isTarget ? 3 : 1, lineStyle: r.isTarget ? 0 : 2, title: 'R' + (i+1), axisLabelVisible: i < 6 });
  });

  chart.timeScale().fitContent();

  window.addEventListener('resize', function() {
    chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  });
})();
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${symbolName}-تحلیل-تکنیکال.html`);
}

// ═══════════════════════════════════════════════════════════════════
// 2. Text file (comprehensive analysis)
// ═══════════════════════════════════════════════════════════════════

export function exportText(data: ExportData) {
  const { symbolName, instrumentLabel, candles, currentPrice, unit,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    resistances, supports, resistanceStrengths, supportStrengths,
    scenarios, aiAnalysis } = data;

  const dateStr = toShamsi(new Date(), 'long');
  const trendLabel = trendDirection === 'up' ? 'صعودی' : trendDirection === 'down' ? 'نزولی' : 'خنثی';
  const r2Pct = (trendR2 * 100).toFixed(1);
  const rsiSignal = rsi > 70 ? 'اشباع خرید شدید' : rsi > 60 ? 'اشباع خرید' : rsi > 40 ? 'خنثی' : rsi > 30 ? 'اشباع فروش' : 'اشباع فروش شدید';
  const signalLabel = overallSignal === 'bullish' ? 'صعودی' : overallSignal === 'bearish' ? 'نزولی' : 'خنثی';

  const sep = '═'.repeat(60);
  const thin = '─'.repeat(60);

  const sortedScenarios = Object.entries(scenarios)
    .sort((a, b) => b[1].probability - a[1].probability);

  const scenariosText = sortedScenarios
    .map(([key, s]) => `  ${s.name}: احتمال ${s.probability}٪ | هدف: ${toEn(s.targetMin)} — ${toEn(s.targetMax)} ${unit}\n  ${s.description}`)
    .join('\n\n');

  const supportsText = supportStrengths.filter(s => s.price > 0).map((s, i) =>
    `  حمایت ${i + 1}: ${toEn(s.price)} ${unit} | قدرت: ${s.strength.toFixed(1)}/۱۰ ${s.grade ? `(${s.grade})` : ''} ${s.isTarget ? '🎯' : ''}`
  ).join('\n');

  const resistancesText = resistanceStrengths.filter(r => r.price > 0).map((r, i) =>
    `  مقاومت ${i + 1}: ${toEn(r.price)} ${unit} | قدرت: ${r.strength.toFixed(1)}/۱۰ ${r.grade ? `(${r.grade})` : ''} ${r.isTarget ? '🎯' : ''}`
  ).join('\n');

  // Last 5 candles
  const lastCandles = candles.slice(-5).reverse().map(c =>
    `  ${c.date} | باز: ${toEn(c.open)} | بالا: ${toEn(c.high)} | پایین: ${toEn(c.low)} | بسته: ${toEn(c.close)} | حجم: ${toEn(c.volume)}`
  ).join('\n');

  const text = `${sep}
  تحلیل تکنیکال ${instrumentLabel}
${sep}
  تاریخ تهیه: ${dateStr}

${thin}
  📍 اطلاعات پایه
${thin}
  قیمت فعلی: ${toEn(currentPrice)} ${unit}
  روند: ${trendLabel} (زاویه: ${trendAngle.toFixed(1)}° | R²: ${r2Pct}٪)
  سیگنال کلی: ${signalLabel}
  تعداد کندل‌ها: ${candles.length}

${thin}
  📊 اندیکاتورها
${thin}
  RSI: ${rsi.toFixed(1)} (${rsiSignal})
  MFI: ${mfi.toFixed(1)}
  CCI: ${cci.toFixed(1)}
  ADX: ${adx.toFixed(1)} ${adx > 25 ? '(روند قوی)' : adx > 15 ? '(روند متوسط)' : '(روند ضعیف)'}
  Stochastic K/D: ${stochK.toFixed(1)} / ${stochD.toFixed(1)}
  MACD Line: ${macdLine.toFixed(1)}
  MACD Signal: ${macdSignal.toFixed(1)}
  MACD Histogram: ${macdHist.toFixed(1)}
  DI+ / DI-: ${diPlus.toFixed(1)} / ${diMinus.toFixed(1)}
  SAR (پارابولیک): ${toEn(sar)}
  ATR (متوسط واقعی محدوده): ${toEn(atr)}
  باندهای بولینگر: بالا=${toEn(bollingerUpper)} | میان=${toEn(bollingerMiddle)} | پایین=${toEn(bollingerLower)}

${thin}
  🎯 سناریوها (مرتب بر حسب احتمال)
${thin}
${scenariosText}

${thin}
  🛡️ سطوح حمایت
${thin}
${supportsText || '  سطح حمایتی شناسایی نشده'}

${thin}
  ⚠️ سطوح مقاومت
${thin}
${resistancesText || '  سطح مقاومتی شناسایی نشده'}

${thin}
  📈 ۵ کندل آخر
${thin}
${lastCandles}
${aiAnalysis ? `\n${sep}\n  🧠 تحلیل هوش مصنوعی\n${sep}\n${aiAnalysis}` : ''}

${sep}
  ⚠️ صرفاً جنبه تحلیلی دارد و توصیه سرمایه‌گذاری نیست.
${sep}`;

  const blob = new Blob([`\uFEFF${text}`], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${symbolName}-تحلیل-متنی.txt`);
}

// ═══════════════════════════════════════════════════════════════════
// 3. Excel file (XLSX)
// ═══════════════════════════════════════════════════════════════════

export async function exportExcel(data: ExportData) {
  const XLSX = await import('xlsx');
  const { symbolName, instrumentLabel, candles, currentPrice, unit,
    rsi, mfi, cci, adx, stochK, stochD, macdLine, macdSignal, macdHist,
    diPlus, diMinus, sar, atr, bollingerUpper, bollingerMiddle, bollingerLower,
    trendDirection, trendAngle, trendR2, overallSignal,
    resistances, supports, resistanceStrengths, supportStrengths,
    scenarios, aiAnalysis } = data;

  const dateStr = toShamsi(new Date(), 'long');
  const closes = candles.map(c => c.close);
  const ma21Arr = computeSMA(closes, 21);
  const ma100Arr = computeSMA(closes, 100);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Candle Data + Indicators ──
  const candleRows = candles.map((c, i) => ({
    'تاریخ': c.date,
    'بازگشایی': c.open,
    'بالاترین': c.high,
    'پایین‌ترین': c.low,
    'پایانی': c.close,
    'حجم': c.volume,
    'MA21': ma21Arr[i] ?? '',
    'MA100': ma100Arr[i] ?? '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(candleRows);
  ws1['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'داده‌های قیمتی');

  // ── Sheet 2: Indicators Summary ──
  const indicatorRows = [
    { 'اندیکاتور': 'قیمت فعلی', 'مقدار': currentPrice, 'واحد': unit },
    { 'اندیکاتور': 'RSI', 'مقدار': +rsi.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'MFI', 'مقدار': +mfi.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'CCI', 'مقدار': +cci.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'ADX', 'مقدار': +adx.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'Stochastic K', 'مقدار': +stochK.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'Stochastic D', 'مقدار': +stochD.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'MACD Line', 'مقدار': +macdLine.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'MACD Signal', 'مقدار': +macdSignal.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'MACD Histogram', 'مقدار': +macdHist.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'DI+', 'مقدار': +diPlus.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'DI-', 'مقدار': +diMinus.toFixed(2), 'واحد': '' },
    { 'اندیکاتور': 'SAR', 'مقدار': sar, 'واحد': unit },
    { 'اندیکاتور': 'ATR', 'مقدار': +atr.toFixed(2), 'واحد': unit },
    { 'اندیکاتور': 'BB بالا', 'مقدار': bollingerUpper, 'واحد': unit },
    { 'اندیکاتور': 'BB میان', 'مقدار': bollingerMiddle, 'واحد': unit },
    { 'اندیکاتور': 'BB پایین', 'مقدار': bollingerLower, 'واحد': unit },
    { 'اندیکاتور': 'MA21', 'مقدار': data.ma21, 'واحد': unit },
    { 'اندیکاتور': 'MA100', 'مقدار': data.ma100, 'واحد': unit },
    { 'اندیکاتور': 'زاویه روند', 'مقدار': +trendAngle.toFixed(2), 'واحد': 'درجه' },
    { 'اندیکاتور': 'R² روند', 'مقدار': +trendR2.toFixed(4), 'واحد': '' },
    { 'اندیکاتور': 'سیگنال کلی', 'مقدار': overallSignal === 'bullish' ? 'صعودی' : overallSignal === 'bearish' ? 'نزولی' : 'خنثی', 'واحد': '' },
  ];
  const ws2 = XLSX.utils.json_to_sheet(indicatorRows);
  ws2['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'اندیکاتورها');

  // ── Sheet 3: Scenarios ──
  const scenarioRows = Object.entries(scenarios).map(([key, s]) => ({
    'کلید': key,
    'سناریو': s.name,
    'احتمال (٪)': s.probability,
    'هدف مین': s.targetMin,
    'هدف ماکس': s.targetMax,
    'توضیحات': s.description,
  }));
  const ws3 = XLSX.utils.json_to_sheet(scenarioRows);
  ws3['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'سناریوها');

  // ── Sheet 4: S/R Levels ──
  const srRows: Record<string, string | number>[] = [];
  supportStrengths.filter(s => s.price > 0).forEach((s, i) => {
    srRows.push({ 'نوع': 'حمایت', 'شماره': i + 1, 'قیمت': s.price, 'قدرت': s.strength, 'درجه': s.grade || '', 'هدف': s.isTarget ? 'بله' : 'خیر' });
  });
  resistanceStrengths.filter(r => r.price > 0).forEach((r, i) => {
    srRows.push({ 'نوع': 'مقاومت', 'شماره': i + 1, 'قیمت': r.price, 'قدرت': r.strength, 'درجه': r.grade || '', 'هدف': r.isTarget ? 'بله' : 'خیر' });
  });
  if (srRows.length > 0) {
    const ws4 = XLSX.utils.json_to_sheet(srRows);
    ws4['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'حمایت و مقاومت');
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${symbolName}-تحلیل-تکنیکال.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════
// 4. CSV file
// ═══════════════════════════════════════════════════════════════════

export function exportCSV(data: ExportData) {
  const { symbolName, candles, currentPrice, unit, rsi, mfi, cci, adx,
    stochK, stochD, macdLine, macdSignal, macdHist, diPlus, diMinus, sar, atr,
    bollingerUpper, bollingerMiddle, bollingerLower, trendDirection, trendAngle, trendR2, overallSignal } = data;

  const closes = candles.map(c => c.close);
  const ma21Arr = computeSMA(closes, 21);
  const ma100Arr = computeSMA(closes, 100);

  const BOM = '\uFEFF';
  const header = 'Date,Open,High,Low,Close,Volume,MA21,MA100\n';
  const rows = candles.map((c, i) =>
    `${c.date},${c.open},${c.high},${c.low},${c.close},${c.volume},${ma21Arr[i] ?? ''},${ma100Arr[i] ?? ''}`
  ).join('\n');

  const csv = BOM + header + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${symbolName}-داده-قیمتی.csv`);
}

// ═══════════════════════════════════════════════════════════════════
// 5. Chart image (PNG)
// ═══════════════════════════════════════════════════════════════════

export function exportChartImage(data: ExportData) {
  const chart = data.chartApi;
  if (!chart) return false;
  try {
    const canvas = chart.takeScreenshot(true, false);
    const url = canvas.toDataURL('image/png');
    const dateStr = toShamsi(new Date(), 'short');
    downloadDataUrl(url, `${data.symbolName}-نمودار-تحلیل-${dateStr}.png`);
    return true;
  } catch {
    return false;
  }
}
