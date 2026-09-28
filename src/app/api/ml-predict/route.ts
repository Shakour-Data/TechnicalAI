import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function GET() {
  try {
    const scriptPath = path.join(process.cwd(), 'api', 'scripts', 'run_ml_predict.py');
    
    let data;
    try {
      const result = execSync(
        `python "${scriptPath}" health`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      data = JSON.parse(result.trim());
    } catch (e) {
      try {
        const resp = await fetch('http://localhost:8000/api/v1/analysis/ml-predict', { signal: AbortSignal.timeout(3000) });
        data = await resp.json();
      } catch {
        data = { status: 'unavailable', service: 'native-ml-engine' };
      }
    }
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'unavailable', service: 'native-ml-engine' }, { status: 503 });
  }
}