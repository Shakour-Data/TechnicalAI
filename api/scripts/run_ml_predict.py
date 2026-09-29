"""CLI script for ML prediction - invoked by Next.js API routes."""
import sys
import json
import os
import asyncio

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from api.services.analysis_service import AnalysisService


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Command required: 'health' or 'analyze'"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "health":
        print(json.dumps({"status": "ok", "native": True}))
        sys.exit(0)

    if command == "analyze":
        # Get symbol from environment variable (avoids Unicode command-line issues on Windows)
        symbol = os.environ.get("ML_SYMBOL", "")
        if not symbol:
            print(json.dumps({"error": "symbol is required"}))
            sys.exit(1)

        # Parse remaining key=value arguments from command line
        args = {}
        for arg in sys.argv[2:]:
            if "=" in arg:
                key, value = arg.split("=", 1)
                args[key] = value

        try:
            horizon = int(args.get("horizon", "30"))
        except ValueError:
            print(json.dumps({"error": "horizon must be an integer"}))
            sys.exit(1)
        model_keys_str = args.get("model_keys", "rf,xgboost,lightgbm,gbr")
        model_keys = [k.strip() for k in model_keys_str.split(",")] if model_keys_str else None

        try:
            service = AnalysisService()
            result = asyncio.run(service.analyze_time_series_quick(symbol, horizon, model_keys))
            print(json.dumps(result, default=str))
            sys.exit(0)
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"error": str(e)}))
            sys.exit(1)

    print(json.dumps({"error": f"Unknown command: {command}"}))
    sys.exit(1)


if __name__ == "__main__":
    main()
