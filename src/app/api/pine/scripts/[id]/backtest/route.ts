/**
 * POST /api/pine/scripts/[id]/backtest — jalankan script pada candle H1
 * yang sudah close (window maks 3000 bar), kembalikan event standar +
 * plot output (mis. ADX) untuk digambar di chart.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePro } from '@/lib/require-pro';
import { checkRateLimit, PineRateLimitError } from '@/lib/pine/pine-runner';
import { PineStoreError, getScript, logRun } from '@/lib/pine/store';
import { runBacktest } from '@/lib/pine/live';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { error, user } = await requirePro(request);
  if (error) return error;
  const { id } = await ctx.params;

  try {
    checkRateLimit(user!.id);
  } catch (e) {
    if (e instanceof PineRateLimitError) {
      return NextResponse.json({ error: e.message, retryAfter: e.retryAfterSec }, { status: 429 });
    }
    throw e;
  }

  let bars = 3000;
  try {
    const body = await request.json();
    if (body && typeof body.bars === 'number') bars = Math.min(Math.max(Math.floor(body.bars), 600), 3000);
  } catch {
    // body opsional
  }

  const script = await getScript(id, user!.id).catch((e) => {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') throw e;
    return null;
  });
  if (!script) return NextResponse.json({ error: 'Script tidak ditemukan' }, { status: 404 });

  try {
    const bt = await runBacktest(script, bars);
    await logRun({
      script_id: script.id,
      user_id: script.user_id,
      trigger: 'manual',
      status: bt.result.ok ? 'ok' : bt.result.error.name === 'TimeoutError' ? 'timeout' : 'error',
      bars: bt.barCount,
      duration_ms: bt.result.ok ? bt.result.durationMs : 0,
      new_events: 0,
      error: bt.result.ok ? undefined : `${bt.result.error.name}: ${bt.result.error.message}`,
    });
    if (!bt.result.ok) {
      const isWorkerUnsupported = bt.result.error.name === 'WorkerSpawnError';
      return NextResponse.json(
        {
          success: false,
          error: `${bt.result.error.name}: ${bt.result.error.message}`,
          workerUnsupported: isWorkerUnsupported,
          droppedDup: bt.droppedDup,
          droppedOrder: bt.droppedOrder,
          barCount: bt.barCount,
        },
        { status: 422 }
      );
    }
    // plots untuk pane chart — dibatasi window terakhir agar payload wajar
    const plots: Record<string, { time: number; value: number | null }[]> = {};
    for (const [name, series] of Object.entries(bt.result.plots || {})) {
      plots[name] = series.slice(-bt.barCount);
    }
    return NextResponse.json({
      success: true,
      mode: bt.result.mode ?? 'worker',
      events: bt.events,
      plots,
      barCount: bt.barCount,
      droppedDup: bt.droppedDup,
      droppedOrder: bt.droppedOrder,
      warnings: bt.result.warnings,
      durationMs: bt.result.durationMs,
      broker: bt.result.strategy
        ? {
            positionSize: bt.result.strategy.position_size,
            openTrades: bt.result.strategy.opentrades.length,
            closedTrades: bt.result.strategy.closedtrades.length,
          }
        : null,
    });
  } catch (e) {
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') {
      return NextResponse.json({ error: e.message, tablesMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
