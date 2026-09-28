/**
 * Data Updater API Route
 * Provides endpoints to trigger and monitor data updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { forceUpdate, getUpdateStatus, scheduleUpdates } from '@/lib/data-updater';

export const dynamic = 'force-dynamic';

// Start the automatic scheduler (for daemon mode)
let schedulerRunning = false;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'status';
  
  try {
    switch (action) {
      case 'status': {
        const status = getUpdateStatus();
        return NextResponse.json({
          success: true,
          data: status
        });
      }
      
      case 'update': {
        const result = await forceUpdate();
        return NextResponse.json({
          success: true,
          data: result,
          message: 'Data update completed'
        });
      }
      
      case 'start': {
        if (!schedulerRunning) {
          schedulerRunning = true;
          scheduleUpdates().catch((err) => {
            console.error('[DataUpdater] Scheduler error:', err);
            schedulerRunning = false;
          });
          return NextResponse.json({
            success: true,
            message: 'Data updater scheduler started',
            interval: '115 minutes'
          });
        }
        return NextResponse.json({
          success: true,
          message: 'Scheduler already running'
        });
      }
      
      case 'stop': {
        schedulerRunning = false;
        return NextResponse.json({
          success: true,
          message: 'Data updater scheduler stopped'
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'update' } = body;
    
    switch (action) {
      case 'update': {
        const result = await forceUpdate();
        return NextResponse.json({
          success: true,
          data: result,
          message: 'Data update completed'
        });
      }
      
      case 'start': {
        if (!schedulerRunning) {
          schedulerRunning = true;
          scheduleUpdates().catch((err) => {
            console.error('[DataUpdater] Scheduler error:', err);
            schedulerRunning = false;
          });
          return NextResponse.json({
            success: true,
            message: 'Data updater scheduler started'
          });
        }
        return NextResponse.json({
          success: true,
          message: 'Scheduler already running'
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}