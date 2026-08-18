# ═════════════════════════════════════════════════════════════════════
# finpy-tse Mini Service
# Wraps finpy-tse library for index & sector price history
# Supports all market index types from finpy-tse
# ═════════════════════════════════════════════════════════════════════

import json
import time
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS

import finpy_tse as tse

app = Flask(__name__)
CORS(app)

# Cache
_cache = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "finpy-tse-service"})


# ── Index function mapping ─────────────────────────────────────────
# Maps the index key (used by Next.js) to the finpy-tse function name
INDEX_FUNCTIONS = {
    "CWI":   tse.Get_CWI_History,      # شاخص کل
    "EWI":   tse.Get_EWI_History,      # شاخص کل هم‌وزن
    "CWPI":  tse.Get_CWPI_History,     # شاخص قیمت وزنی-ارزشی
    "EWPI":  tse.Get_EWPI_History,     # شاخص قیمت هم‌وزن
    "FFI":   tse.Get_FFI_History,      # شاخص سهام آزاد شناور
    "MKT1I": tse.Get_MKT1I_History,    # شاخص بازار اول
    "MKT2I": tse.Get_MKT2I_History,    # شاخص بازار دوم
    "INDI":  tse.Get_INDI_History,     # شاخص صنعت
    "ACT50": tse.Get_ACT50_History,    # شاخص ۵۰ شرکت فعال‌تر
    "LCI30": tse.Get_LCI30_History,    # شاخص ۳۰ شرکت بزرگ
}


@app.route("/api/index-history")
def index_history():
    """Get price history for a main market index using finpy-tse.

    Query params:
        key: (str) Index function key — one of:
              CWI, EWI, CWPI, EWPI, FFI, MKT1I, MKT2I, INDI, ACT50, LCI30
        start_date: (str, optional) Shamsi start '1395-01-01'
        end_date: (str, optional) Shamsi end '1410-12-29'
        ignore_date: (bool, default true)
    """
    key = request.args.get("key", "").strip().upper()
    if not key or key not in INDEX_FUNCTIONS:
        return jsonify({
            "error": f"Invalid index key. Use one of: {', '.join(INDEX_FUNCTIONS.keys())}",
            "candles": []
        }), 400

    start_date = request.args.get("start_date", "1395-01-01")
    end_date = request.args.get("end_date", "1410-12-29")
    ignore_date = request.args.get("ignore_date", "true").lower() == "true"

    # Check cache
    cache_key = f"idx_{key}_{start_date}_{end_date}"
    now = time.time()
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return jsonify(cached_data)

    try:
        func = INDEX_FUNCTIONS[key]
        df = func(
            start_date=start_date,
            end_date=end_date,
            ignore_date=ignore_date,
            just_adj_close=False,
            show_weekday=False,
            double_date=False,
        )

        if df is None or df.empty:
            return jsonify({"error": f"No data for index: {key}", "candles": []}), 404

        # Convert DataFrame to candle list
        candles = []
        for idx, row in df.iterrows():
            date_str = str(idx).replace("-", "/") if "-" in str(idx) else str(idx)
            candles.append({
                "date": date_str,
                "open": float(row.get("Open", 0) or 0),
                "high": float(row.get("High", 0) or 0),
                "low": float(row.get("Low", 0) or 0),
                "close": float(row.get("Close", 0) or 0),
                "adj_close": float(row.get("Adj Close", 0) or 0),
                "volume": int(row.get("Volume", 0) or 0),
            })

        # Sort oldest first
        candles.sort(key=lambda x: x["date"])

        result = {"index_key": key, "count": len(candles), "candles": candles}
        _cache[cache_key] = (result, now)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "candles": []}), 500


@app.route("/api/sector-history")
def sector_history():
    """Get price history for a sector/industry index using finpy-tse.

    Query params:
        sector: (str) Sector name in Persian (e.g., 'خودرو')
        start_date: (str, optional) Start date in Shamsi format '1400-01-01'
        end_date: (str, optional) End date in Shamsi format '1404-12-29'
        ignore_date: (bool, default true)
    """
    sector = request.args.get("sector", "").strip()
    if not sector:
        return jsonify({"error": "sector parameter is required"}), 400

    start_date = request.args.get("start_date", "1395-01-01")
    end_date = request.args.get("end_date", "1410-12-29")
    ignore_date = request.args.get("ignore_date", "true").lower() == "true"

    # Check cache
    cache_key = f"sec_{sector}_{start_date}_{end_date}"
    now = time.time()
    if cache_key in _cache:
        cached_data, cached_time = _cache[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return jsonify(cached_data)

    try:
        df = tse.Get_SectorIndex_History(
            sector=sector,
            start_date=start_date,
            end_date=end_date,
            ignore_date=ignore_date,
            just_adj_close=False,
            show_weekday=False,
            double_date=False,
        )

        if df is None or df.empty:
            return jsonify({"error": f"No data found for sector: {sector}", "candles": []}), 404

        # Convert DataFrame to list of candle objects
        candles = []
        for idx, row in df.iterrows():
            date_str = str(idx).replace("-", "/") if "-" in str(idx) else str(idx)
            candles.append({
                "date": date_str,
                "open": float(row.get("Open", 0) or 0),
                "high": float(row.get("High", 0) or 0),
                "low": float(row.get("Low", 0) or 0),
                "close": float(row.get("Close", 0) or 0),
                "adj_close": float(row.get("Adj Close", 0) or 0),
                "volume": int(row.get("Volume", 0) or 0),
            })

        candles.sort(key=lambda x: x["date"])

        result = {"sector": sector, "count": len(candles), "candles": candles}
        _cache[cache_key] = (result, now)
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "candles": []}), 500


@app.route("/api/sector-list")
def sector_list():
    """Return the list of available sector names from finpy-tse."""
    sectors = [
        {"name": "زراعت", "web_id": 34408080767216529},
        {"name": "ذغال سنگ", "web_id": 19219679288446732},
        {"name": "کانی فلزی", "web_id": 13235969998952202},
        {"name": "سایر معادن", "web_id": 62691002126902464},
        {"name": "منسوجات", "web_id": 59288237226302898},
        {"name": "محصولات چرمی", "web_id": 69306841376553334},
        {"name": "محصولات چوبی", "web_id": 58440550086834602},
        {"name": "محصولات کاغذی", "web_id": 30106839080444358},
        {"name": "انتشار و چاپ", "web_id": 25766336681098389},
        {"name": "فرآورده‌های نفتی", "web_id": 12331083953323969},
        {"name": "لاستیک", "web_id": 36469751685735891},
        {"name": "فلزات اساسی", "web_id": 32453344048876642},
        {"name": "محصولات فلزی", "web_id": 1123534346391630},
        {"name": "ماشین‌آلات", "web_id": 11451389074113298},
        {"name": "دستگاه‌های برقی", "web_id": 33878047680249697},
        {"name": "وسایل ارتباطی", "web_id": 24733701189547084},
        {"name": "خودرو", "web_id": 20213770409093165},
        {"name": "قند و شکر", "web_id": 21948907150049163},
        {"name": "چند رشته‌ای", "web_id": 40355846462826897},
        {"name": "تامین آب، برق و گاز", "web_id": 54843635503648458},
        {"name": "غذایی", "web_id": 15508900928481581},
        {"name": "دارویی", "web_id": 3615666621538524},
        {"name": "شیمیایی", "web_id": 33626672012415176},
        {"name": "خرده فروشی", "web_id": 65986638607018835},
        {"name": "کاشی و سرامیک", "web_id": 57616105980228781},
        {"name": "سیمان", "web_id": 70077233737515808},
        {"name": "کانی غیر فلزی", "web_id": 14651627750314021},
        {"name": "سرمایه‌گذاری", "web_id": 34295935482222451},
        {"name": "بانک", "web_id": 72002976013856737},
        {"name": "سایر مالی", "web_id": 25163959460949732},
        {"name": "حمل و نقل", "web_id": 24187097921483699},
        {"name": "رادیویی", "web_id": 41867092385281437},
        {"name": "مالی", "web_id": 61247168213690670},
        {"name": "اداره بازارهای مالی", "web_id": 61985386521682984},
        {"name": "انبوه‌سازی", "web_id": 4654922806626448},
        {"name": "رایانه", "web_id": 8900726085939949},
        {"name": "اطلاعات و ارتباطات", "web_id": 18780171241610744},
        {"name": "فنی مهندسی", "web_id": 47233872677452574},
        {"name": "استخراج نفت", "web_id": 65675836323214668},
        {"name": "بیمه و بازنشستگی", "web_id": 59105676994811497},
    ]
    return jsonify({"sectors": sectors})


if __name__ == "__main__":
    print("Starting finpy-tse service on port 3031...")
    print(f"Available index functions: {', '.join(INDEX_FUNCTIONS.keys())}")
    app.run(host="0.0.0.0", port=3031, debug=False)
