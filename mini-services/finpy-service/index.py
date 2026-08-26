# finpy-tse candlestick data service
# Provides TSE historical price data as a fallback when BrsApi is unavailable

import json
import sys
import os
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# We import finpy_tse lazily to avoid slow startup
finpy_tse = None

def get_finpy():
    global finpy_tse
    if finpy_tse is None:
        import finpy_tse
        finpy_tse = finpy_tse
    return finpy_tse


class FinpyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, msg, status=500):
        self._send_json({'error': msg}, status)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        try:
            if path == '/candle':
                self._handle_candle(params)
            elif path == '/health':
                self._send_json({'status': 'ok', 'finpy_available': True})
            elif path == '/sector-candle':
                self._handle_sector_candle(params)
            elif path == '/index-history':
                self._handle_index_history(params)
            else:
                self._send_error('Not found', 404)
        except Exception as e:
            traceback.print_exc()
            self._send_error(str(e), 500)

    def _handle_candle(self, params):
        """
        Fetch candlestick data for a stock symbol.
        Params: symbol (Persian name), adjust (0/1, default 1)
        Returns: { candles: [{date, open, high, low, close, volume}] }
        """
        symbol = params.get('symbol', [None])[0]
        if not symbol:
            return self._send_error('symbol is required', 400)

        adjust = params.get('adjust', ['1'])[0] == '1'
        start_date = params.get('start', ['1398-01-01'])[0]
        end_date = params.get('end', ['1405-01-01'])[0]

        tse = get_finpy()
        df = tse.Get_Price_History(
            stock=symbol,
            start_date=start_date,
            end_date=end_date,
            adjust_price=adjust,
            show_weekday=False,
            double_date=False,
        )

        if df is None or df.empty:
            return self._send_json({'candles': [], 'symbol': symbol})

        candles = []
        for idx, row in df.iterrows():
            date_str = str(idx.date()) if hasattr(idx, 'date') else str(idx)
            try:
                candles.append({
                    'date': date_str,
                    'open': float(row.get('Open', 0) or 0),
                    'high': float(row.get('High', 0) or 0),
                    'low': float(row.get('Low', 0) or 0),
                    'close': float(row.get('Close', 0) or 0),
                    'volume': float(row.get('Volume', 0) or 0),
                })
            except (ValueError, TypeError):
                continue

        print(f'[finpy] Fetched {len(candles)} candles for {symbol}')
        self._send_json({'candles': candles, 'symbol': symbol})

    def _handle_sector_candle(self, params):
        """
        Fetch sector index historical data.
        Params: sector (Persian sector name, e.g. 'دارویی'), adjust (0/1)
        """
        sector = params.get('sector', [None])[0]
        if not sector:
            return self._send_error('sector is required', 400)

        adjust = params.get('adjust', ['1'])[0] == '1'
        start_date = params.get('start', ['1398-01-01'])[0]
        end_date = params.get('end', ['1405-01-01'])[0]

        tse = get_finpy()
        df = tse.Get_SectorIndex_History(
            sector=sector,
            adjust_price=adjust,
            show_weekday=False,
            double_date=False,
        )

        if df is None or df.empty:
            return self._send_json({'candles': [], 'sector': sector})

        candles = []
        for idx, row in df.iterrows():
            date_str = str(idx.date()) if hasattr(idx, 'date') else str(idx)
            try:
                candles.append({
                    'date': date_str,
                    'open': float(row.get('Open', 0) or 0),
                    'high': float(row.get('High', 0) or 0),
                    'low': float(row.get('Low', 0) or 0),
                    'close': float(row.get('Close', 0) or 0),
                    'volume': float(row.get('Volume', 0) or 0),
                })
            except (ValueError, TypeError):
                continue

        print(f'[finpy] Fetched {len(candles)} sector candles for {sector}')
        self._send_json({'candles': candles, 'sector': sector})

    def _handle_index_history(self, params):
        """
        Fetch main TSE index historical data.
        Params: index_key (e.g. 'CWI', 'EWI', 'FFI', 'MKT1I', etc.)
        """
        index_key = params.get('index_key', [None])[0]
        if not index_key:
            return self._send_error('index_key is required', 400)

        start_date = params.get('start', ['1398-01-01'])[0]
        end_date = params.get('end', ['1405-01-01'])[0]

        tse = get_finpy()

        # Map index keys to finpy-tse functions
        func_map = {
            'CWI': 'Get_CWI_History',
            'EWI': 'Get_EWI_History',
            'CWPI': 'Get_CWPI_History',
            'EWPI': 'Get_EWPI_History',
            'FFI': 'Get_FFI_History',
            'MKT1I': 'Get_MKT1I_History',
            'MKT2I': 'Get_MKT2I_History',
            'INDI': 'Get_INDI_History',
            'ACT50': 'Get_ACT50_History',
            'LCI30': 'Get_LCI30_History',
        }

        func_name = func_map.get(index_key)
        if not func_name or not hasattr(tse, func_name):
            return self._send_error(f'Unknown index_key: {index_key}. Available: {list(func_map.keys())}', 400)

        func = getattr(tse, func_name)
        df = func()

        if df is None or df.empty:
            return self._send_json({'candles': [], 'index_key': index_key})

        candles = []
        for idx, row in df.iterrows():
            date_str = str(idx.date()) if hasattr(idx, 'date') else str(idx)
            try:
                candles.append({
                    'date': date_str,
                    'open': float(row.get('Open', 0) or 0),
                    'high': float(row.get('High', 0) or 0),
                    'low': float(row.get('Low', 0) or 0),
                    'close': float(row.get('Close', 0) or 0),
                    'volume': float(row.get('Volume', 0) or 0),
                })
            except (ValueError, TypeError):
                continue

        print(f'[finpy] Fetched {len(candles)} index candles for {index_key}')
        self._send_json({'candles': candles, 'index_key': index_key})


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3030))
    server = HTTPServer(('0.0.0.0', PORT), FinpyHandler)
    print(f'[finpy] finpy-tse service starting on port {PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('[finpy] Shutting down')
        server.server_close()
