/**
 * store.ts — akses data Pine Signals via Supabase (pola proyek: service-role
 * admin untuk operasi server; RLS melindungi akses langsung dari klien).
 *
 * ATURAN PROYEK: DDL dieksekusi manual oleh Bos di Supabase SQL Editor
 * (supabase/migrations/20261112_pine_signals.sql). Sebelum tabel ada,
 * semua fungsi melempar PineStoreError dengan code TABLES_MISSING supaya
 * API membalas 503 yang jujur — bukan 500.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt';

export interface PineScriptRow {
  id: string;
  user_id: string;
  name: string;
  kind: 'strategy' | 'indicator';
  source: string;
  version: number;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  validation: {
    ok: boolean;
    errors: unknown[];
    warnings: unknown[];
    validatedAt: string;
  } | null;
  config: Record<string, unknown>;
  symbol: string;
  timeframe: string;
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PineEventRow {
  id: string;
  script_id: string;
  user_id: string;
  event: string;
  candle_time: number;
  side: string | null;
  payload: Record<string, unknown>;
  delivered: boolean;
  channels: unknown[];
  delivered_at: string | null;
  created_at: string;
}

export class PineStoreError extends Error {
  constructor(
    public code: 'TABLES_MISSING' | 'DB_UNAVAILABLE' | 'DB_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'PineStoreError';
  }
}

function mapPgError(e: { code?: string; message?: string }): PineStoreError {
  const code = e?.code || '';
  if (code === '42P01' || code === 'PGRST205' || (e?.message || '').includes('does not exist')) {
    return new PineStoreError(
      'TABLES_MISSING',
      'Tabel Pine Signals belum dibuat. Jalankan supabase/migrations/20261112_pine_signals.sql di Supabase SQL Editor.'
    );
  }
  return new PineStoreError('DB_ERROR', e?.message || 'Kesalahan database');
}

function admin() {
  const a = getSupabaseAdmin();
  if (!a) throw new PineStoreError('DB_UNAVAILABLE', 'Supabase admin tidak tersedia');
  return a;
}

// ---------------- scripts ----------------

export async function listScripts(userId: string): Promise<PineScriptRow[]> {
  try {
    const { data, error } = await admin()
      .from('pine_scripts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw mapPgError(error);
    return (data || []) as PineScriptRow[];
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function getScript(id: string, userId: string): Promise<PineScriptRow | null> {
  try {
    const { data, error } = await admin()
      .from('pine_scripts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw mapPgError(error);
    return (data as PineScriptRow) || null;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function getScriptById(id: string): Promise<PineScriptRow | null> {
  try {
    const { data, error } = await admin().from('pine_scripts').select('*').eq('id', id).maybeSingle();
    if (error) throw mapPgError(error);
    return (data as PineScriptRow) || null;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function createScript(row: {
  user_id: string;
  name: string;
  kind: 'strategy' | 'indicator';
  source: string;
  validation: PineScriptRow['validation'];
  config: Record<string, unknown>;
  symbol: string;
  timeframe: string;
}): Promise<PineScriptRow> {
  try {
    const { data, error } = await admin()
      .from('pine_scripts')
      .insert(row)
      .select('*')
      .single();
    if (error) throw mapPgError(error);
    // simpan versi pertama
    await admin().from('pine_script_versions').insert({
      script_id: (data as PineScriptRow).id,
      version: 1,
      source: row.source,
      validation: row.validation,
    });
    return data as PineScriptRow;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function updateScript(
  id: string,
  userId: string,
  patch: Partial<Pick<PineScriptRow, 'name' | 'source' | 'config' | 'status' | 'alerts_enabled' | 'symbol' | 'timeframe' | 'kind' | 'validation' | 'version'>>
): Promise<PineScriptRow> {
  try {
    const { data, error } = await admin()
      .from('pine_scripts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw mapPgError(error);
    const updated = data as PineScriptRow;
    // source berubah -> catat versi baru
    if (patch.source) {
      await admin().from('pine_script_versions').insert({
        script_id: updated.id,
        version: updated.version,
        source: patch.source,
        validation: updated.validation,
      });
    }
    return updated;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function deleteScript(id: string, userId: string): Promise<void> {
  try {
    const { error } = await admin().from('pine_scripts').delete().eq('id', id).eq('user_id', userId);
    if (error) throw mapPgError(error);
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function listActiveScripts(limit = 50): Promise<PineScriptRow[]> {
  try {
    const { data, error } = await admin()
      .from('pine_scripts')
      .select('*')
      .eq('status', 'ACTIVE')
      .eq('alerts_enabled', true)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw mapPgError(error);
    return (data || []) as PineScriptRow[];
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

// ---------------- events (idempotensi) ----------------

/**
 * Sisipkan event dengan kunci idempotensi. HANYA event baru yang dikembalikan.
 *
 * Implementasi sengaja TIDAK mengandalkan semantik return upsert PostgREST:
 *  1. pre-select id yang sudah ada (chunked)
 *  2. sisipkan hanya yang belum ada
 *  3. duplikat (race 23505) diabaikan
 * Dengan demikian restart/retry tidak pernah menghasilkan alert ganda (Uji C).
 */
export async function insertEventsIfNew(
  rows: {
    id: string;
    script_id: string;
    user_id: string;
    event: string;
    candle_time: number;
    side: string | null;
    payload: Record<string, unknown>;
  }[]
): Promise<PineEventRow[]> {
  if (rows.length === 0) return [];
  try {
    const a = admin();
    // 1) id yang sudah ada
    const existing = new Set<string>();
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => r.id);
      const { data, error } = await a.from('pine_events').select('id').in('id', chunk);
      if (error) throw mapPgError(error);
      for (const r of data || []) existing.add((r as { id: string }).id);
    }
    // 2) sisipkan hanya yang benar-benar baru
    const fresh = rows.filter((r) => !existing.has(r.id));
    if (fresh.length === 0) return [];
    const inserted: PineEventRow[] = [];
    for (let i = 0; i < fresh.length; i += 100) {
      const chunk = fresh.slice(i, i + 100);
      const { data, error } = await a.from('pine_events').insert(chunk).select('*');
      if (error) {
        // batch gagal karena duplikat race -> jatuh ke per-baris
        if ((error as { code?: string }).code === '23505') {
          for (const r of chunk) {
            const { data: one, error: oneErr } = await a.from('pine_events').insert(r).select('*');
            if (!oneErr && one) inserted.push(one[0] as PineEventRow);
          }
          continue;
        }
        throw mapPgError(error);
      }
      for (const r of data || []) inserted.push(r as PineEventRow);
    }
    return inserted;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function listEvents(userId: string, limit = 50): Promise<PineEventRow[]> {
  try {
    const { data, error } = await admin()
      .from('pine_events')
      .select('*')
      .eq('user_id', userId)
      .order('candle_time', { ascending: false })
      .limit(limit);
    if (error) throw mapPgError(error);
    return (data || []) as PineEventRow[];
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function listUndeliveredEvents(userId: string, limit = 100): Promise<PineEventRow[]> {
  try {
    const { data, error } = await admin()
      .from('pine_events')
      .select('*')
      .eq('user_id', userId)
      .eq('delivered', false)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw mapPgError(error);
    return (data || []) as PineEventRow[];
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function markEventsDelivered(ids: string[], channels: unknown): Promise<void> {
  if (ids.length === 0) return;
  try {
    const { error } = await admin()
      .from('pine_events')
      .update({ delivered: true, delivered_at: new Date().toISOString(), channels })
      .in('id', ids);
    if (error) throw mapPgError(error);
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

// ---------------- alert channels ----------------

export interface PineChannelRow {
  id: string;
  user_id: string;
  type: 'push' | 'telegram' | 'webhook';
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export async function listChannels(userId: string): Promise<PineChannelRow[]> {
  try {
    const { data, error } = await admin()
      .from('pine_alert_channels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw mapPgError(error);
    return (data || []) as PineChannelRow[];
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function upsertChannel(
  userId: string,
  type: PineChannelRow['type'],
  config: Record<string, unknown>,
  enabled = true
): Promise<PineChannelRow> {
  try {
    const { data, error } = await admin()
      .from('pine_alert_channels')
      .upsert(
        { user_id: userId, type, config, enabled },
        { onConflict: 'user_id,type' }
      )
      .select('*')
      .single();
    if (error) throw mapPgError(error);
    return data as PineChannelRow;
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

export async function deleteChannel(id: string, userId: string): Promise<void> {
  try {
    const { error } = await admin()
      .from('pine_alert_channels')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw mapPgError(error);
  } catch (e) {
    if (e instanceof PineStoreError) throw e;
    throw mapPgError(e as { code?: string; message?: string });
  }
}

// ---------------- runs (audit) ----------------

export async function logRun(row: {
  script_id: string;
  user_id: string;
  trigger: 'manual' | 'live' | 'validation';
  status: 'ok' | 'error' | 'timeout';
  bars?: number;
  duration_ms?: number;
  new_events?: number;
  error?: string;
}): Promise<void> {
  try {
    await admin().from('pine_runs').insert(row);
  } catch (e) {
    // audit gagal tidak boleh merusak alur utama
    if (e instanceof PineStoreError && e.code === 'TABLES_MISSING') return;
    console.warn('[pine-store] logRun gagal:', (e as Error).message);
  }
}
