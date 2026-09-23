'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ExternalLink, Shield,
  Loader2, CheckCircle2, AlertCircle,
  CreditCard, Lock
} from 'lucide-react';
import { formatRupiah } from '@/lib/pricing';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  email?: string;
  planName?: string;
  amount?: number;
  plan?: string;
  durationMonths?: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  planName = 'Elite Pro',
  amount = 39000,
  plan = 'PRO',
}: PaymentModalProps) {
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);

  // Map internal plan to Midtrans PricingPlan key
  const midtransPlanKey = plan === 'LIFETIME'
    ? 'PRO_LIFETIME'
    : plan === 'PRO' && amount >= 300000
      ? 'PRO_ANNUAL'
      : 'PRO_30_DAYS';

  // ── Load Midtrans Snap.js ──────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if ((window as any).snap) { setSnapLoaded(true); return }

    const loadSnap = async () => {
      setSnapLoading(true);
      try {
        const res = await fetch('/api/midtrans/create-transaction');
        const config = await res.json();
        if (!config.configured || !config.snapUrl) {
          setSnapLoading(false);
          return;
        }
        const script = document.createElement('script');
        script.id = 'midtrans-snap-payment-modal';
        script.src = config.snapUrl;
        script.setAttribute('data-client-key', config.clientKey);
        script.async = true;
        script.onload = () => { setSnapLoaded(true); setSnapLoading(false); };
        script.onerror = () => { setSnapLoading(false); };
        document.body.appendChild(script);
      } catch {
        setSnapLoading(false);
      }
    };
    loadSnap();
  }, [isOpen]);

  // ── Handle Pay via Midtrans Snap ──────────────
  const handlePay = async () => {
    if (!snapLoaded) {
      setPayError('Payment gateway sedang dimuat, tunggu sebentar...');
      return;
    }
    setPaying(true);
    setPayError('');

    try {
      const res = await fetch('/api/midtrans/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: midtransPlanKey }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Gagal membuat transaksi');
      }

      // Open Midtrans Snap payment popup
      (window as any).snap.pay(data.token, {
        onSuccess: () => {
          setPaying(false);
          setPaid(true);
        },
        onPending: () => {
          setPaying(false);
          setPaid(true);
        },
        onError: () => {
          setPaying(false);
          setPayError('Pembayaran gagal. Coba lagi.');
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaying(false);
      setPayError(error.message || 'Gagal membuat pembayaran. Coba lagi.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {/* Neon Glow Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-blue-500/10 to-cyan-400/20 blur-xl rounded-3xl" />
          <div className="absolute inset-0 shadow-[0_0_40px_rgba(138,43,226,0.3)] rounded-3xl" />

          {/* Main Card */}
          <div className="relative bg-[#0A0A0A]/95 border border-blue-500/30 rounded-2xl overflow-hidden">
            {/* Animated Border */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent animate-pulse" />
            </div>

            {/* Header */}
            <div className="relative p-6 border-b border-blue-500/20">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" />

              <div className="flex items-center justify-between">
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-bold tracking-widest text-cyan-400 mb-1"
                  >
                    UPGRADE MEMBERSHIP
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white"
                  >
                    {paid ? 'Pembayaran Diproses' : 'Pembayaran via Midtrans'}
                  </motion.h2>
                  <p className="text-cyan-300/70 text-xs mt-1">
                    {paid ? 'PRO sedang diaktivasi otomatis' : `${planName} — ${formatRupiah(amount)}`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Success State */}
              {paid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex flex-col items-center gap-3"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-300">Pembayaran Diproses!</p>
                    <p className="text-sm text-white/60 mt-1">
                      Akun PRO akan aktif otomatis setelah pembayaran dikonfirmasi
                    </p>
                  </div>
                </motion.div>
              )}

              {!paid && (
                <>
                  {/* Info */}
                  <div className="space-y-3">
                    <p className="text-xs text-cyan-300 font-medium flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Midtrans Snap Payment
                    </p>
                    <p className="text-sm text-white/60">
                      Klik tombol di bawah untuk membuka halaman pembayaran Midtrans. 
                      Mendukung QRIS, GoPay, OVO, DANA, Virtual Account, dan lainnya.
                    </p>
                  </div>

                  {/* Error */}
                  {payError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{payError}</span>
                    </motion.div>
                  )}

                  {/* ===== MAIN PAY BUTTON — Midtrans Snap ===== */}
                  <motion.button
                    whileHover={!paying && !snapLoading ? { scale: 1.01 } : {}}
                    whileTap={!paying && !snapLoading ? { scale: 0.98 } : {}}
                    onClick={handlePay}
                    disabled={paying || snapLoading}
                    className={`
                      w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                      ${!paying && !snapLoading
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                        : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
                      }
                    `}
                  >
                    {snapLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Memuat Payment Gateway...
                      </>
                    ) : paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Membuat Transaksi...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-5 h-5" />
                        Bayar Sekarang — {formatRupiah(amount)}
                      </>
                    )}
                  </motion.button>

                  {/* Security Badge */}
                  <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <Shield className="w-3 h-3" />
                    Pembayaran aman & terenkripsi via Midtrans
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
