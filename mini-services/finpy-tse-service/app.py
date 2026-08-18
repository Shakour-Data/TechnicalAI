# ═══════════════════════════════════════════════════════════════════
# finpy-tse Mini Service
# Wraps finpy-tse library for industry/sector index price history
# ═══════════════════════════════════════════════════════════════════

import json
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS

import finpy_tse as tse

app = Flask(__name__)
CORS(app)

# Cache for sector index data to avoid repeated calls
_sector_cache = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "finpy-tse-service"})


@app.route("/api/sector-list")
def sector_list():
    """Return the list of available sector names and their web IDs from finpy-tse."""
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


@app.route("/api/sector-history")
def sector_history():
    """Get price history for a sector/industry index using finpy-tse.

    Query params:
        sector: (str) Sector name in Persian (e.g., 'خودرو')
        start_date: (str, optional) Start date in Shamsi format '1400-01-01'
        end_date: (str, optional) End date in Shamsi format '1404-12-29'
        ignore_date: (bool, default true) If true, returns all available history
    """
    sector = request.args.get("sector", "").strip()
    if not sector:
        return jsonify({"error": "sector parameter is required"}), 400

    start_date = request.args.get("start_date", "1395-01-01")
    end_date = request.args.get("end_date", "1410-12-29")
    ignore_date = request.args.get("ignore_date", "true").lower() == "true"

    # Check cache
    cache_key = f"{sector}_{start_date}_{end_date}"
    import time
    now = time.time()
    if cache_key in _sector_cache:
        cached_data, cached_time = _sector_cache[cache_key]
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
        # Columns: Open, High, Low, Close, Adj Close, Volume
        candles = []
        for idx, row in df.iterrows():
            # idx is J-Date string like '1404/01/15'
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

        # Sort by date (oldest first)
        candles.sort(key=lambda x: x["date"])

        result = {"sector": sector, "count": len(candles), "candles": candles}

        # Cache result
        _sector_cache[cache_key] = (result, now)

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "candles": []}), 500


@app.route("/api/main-index-history")
def main_index_history():
    """Get price history for main market indices using finpy-tse.

    Supported indices: شاخص کل (TEPIX), شاخص ۵۰ شرکت, etc.
    Uses get_tse_webid to find the instrument code, then fetches price history.
    """
    index_name = request.args.get("index", "").strip()
    if not index_name:
        return jsonify({"error": "index parameter is required"}), 400

    try:
        # For main indices like شاخص کل, we use the price history endpoint
        # First get the web ID
        webid_df = tse.get_tse_webid(stock=index_name)
        if webid_df is None or webid_df.empty:
            return jsonify({"error": f"Could not find web ID for: {index_name}", "candles": []}), 404

        web_id = str(webid_df.iloc[0]["web_id"])

        # Fetch closing price history from TSETMC CDN API
        import requests
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        url = f"http://cdn.tsetmc.com/api/Index/GetIndexB2History/{web_id}"
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()

        data = resp.json()
        entries = data.get("indexB2", [])
        if not entries:
            return jsonify({"error": "No history data found", "candles": []}), 404

        candles = []
        for entry in entries:
            d_even = str(entry.get("dEven", ""))
            if len(d_even) < 8:
                continue
            # Convert DEven (Jalali) to formatted string
            date_str = f"{d_even[:4]}/{d_even[4:6]}/{d_even[6:8]}"
            close_val = entry.get("xNivInuClMresIbs", 0)
            candles.append({
                "date": date_str,
                "open": 0,  # API only provides close
                "high": 0,
                "low": 0,
                "close": float(close_val),
                "adj_close": float(close_val),
                "volume": 0,
            })

        # Sort by date
        candles.sort(key=lambda x: x["date"])

        result = {"index": index_name, "web_id": web_id, "count": len(candles), "candles": candles}
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "candles": []}), 500


if __name__ == "__main__":
    print("Starting finpy-tse service on port 3031...")
    app.run(host="0.0.0.0", port=3031, debug=False)
