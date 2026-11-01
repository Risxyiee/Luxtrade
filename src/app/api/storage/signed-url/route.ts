import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

/**
 * Generate signed URL for private storage images
 * This allows accessing private bucket images temporarily
 *
 * SECURITY (audit #4 — broken access control, dulu HIGH):
 * Dulu route ini menerima bucket + path APA PUN dan menandatanganinya dengan
 * ADMIN/SERVICE-ROLE client (bypass RLS). User login apa pun bisa membaca
 * file milik user lain: POST {"bucket":"trade-screenshots","path":"<uuid-lain>/x.jpg"}.
 *
 * Hardening:
 *  1. Allowlist bucket → prefix milik pemanggil (ownership enforced server-side).
 *  2. Path WAJIB diawali folder user pemanggil — tidak bisa menandatangani
 *     objek milik orang lain.
 *  3. Cap expiresIn max 3600 detik.
 *  4. Karakter path divalidasi (blokir `..` path traversal).
 */

/** Map bucket → prefix folder yang dimiliki user (scoped per user id) */
const BUCKET_PREFIX: Record<string, (userId: string) => string> = {
  'trade-screenshots': (userId) => `${userId}/`,
  'testimonials': (userId) => `certificates/${userId}/`,
};

const MAX_EXPIRES_IN = 3600;

/** Path valid: tidak boleh '..' dan hanya karakter aman storage key */
const SAFE_PATH_RE = /^[A-Za-z0-9._\-/]+$/;

export async function POST(request: NextRequest) {
  try {
    // FIX (audit #4): dulu pakai `if (!authUser)` padahal getAuthenticatedUser
    // SELALU balik objek truthy {user, client, error} → cek auth TIDAK PERNAH
    // jalan (route efektif tanpa auth). requireAuth punya kontrak yang benar:
    // response non-null = belum login.
    const { user: authUser, response: authError } = await requireAuth(request)
    if (authError || !authUser) {
      return authError ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bucket, path, expiresIn = 3600 } = await request.json();

    if (!bucket || !path || typeof bucket !== 'string' || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'bucket and path are required' },
        { status: 400 }
      );
    }

    // (1) Bucket harus ada di allowlist
    const prefixBuilder = BUCKET_PREFIX[bucket];
    if (!prefixBuilder) {
      return NextResponse.json(
        { error: 'Bucket tidak diizinkan' },
        { status: 403 }
      );
    }

    // (2) Path WAJIB milik user pemanggil (bypass-proof, tidak bisa minta
    //     objek milik user lain meski bucket-nya benar)
    const requiredPrefix = prefixBuilder(authUser.id);
    if (!path.startsWith(requiredPrefix)) {
      return NextResponse.json(
        { error: 'Path bukan milik Anda' },
        { status: 403 }
      );
    }

    // (3) Path traversal & karakter aneh diblokir
    if (path.includes('..') || !SAFE_PATH_RE.test(path)) {
      return NextResponse.json(
        { error: 'Path tidak valid' },
        { status: 400 }
      );
    }

    // (4) Cap TTL — tidak bisa minta signed URL berumur sangat panjang
    const ttl = Math.min(
      Math.max(Number(expiresIn) || MAX_EXPIRES_IN, 60),
      MAX_EXPIRES_IN
    );

    // Import Supabase admin client
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttl);

    if (error) {
      console.error('Error generating signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn: ttl
    });

  } catch (error: any) {
    console.error('Error in signed URL API:', error);
    // SECURITY (audit #14): jangan bocorkan error.message mentah ke client
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
