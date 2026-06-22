'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, Check, ExternalLink, Clock, Shield,
  Loader2, CheckCircle2, AlertCircle,
  QrCode, Smartphone, Banknote, CreditCard, Lock
} from 'lucide-react';
import { formatRupiah } from '@/lib/pricing';

// ============================================
// Payment method categories mapped to SakuraPay codes
// ============================================
const PAYMENT_CATEGORIES: {
  type: string
  label: string
  icon: typeof Banknote
  methods: { code: string; label: string }[]
  color: { sel: string; unsel: string; glow: string; iconBg: string }
}[] = [
  {
    type: 'QRIS',
    label: 'QRIS',
    icon: QrCode,
    methods: [{ code: 'QRIS', label: 'QRIS' }],
    color: {
      sel: 'border-emerald-400 bg-emerald-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-emerald-500/30 shadow-lg',
      iconBg: 'bg-emerald-500',
    },
  },
  {
    type: 'EWALLET',
    label: 'E-Wallet',
    icon: Smartphone,
    methods: [
      { code: 'GOPAY', label: 'GoPay' },
      { code: 'DANA', label: 'DANA' },
      { code: 'OVO', label: 'OVO' },
      { code: 'SHOPEEPAY', label: 'ShopeePay' },
      { code: 'LINKAJA', label: 'LinkAja' },
    ],
    color: {
      sel: 'border-violet-400 bg-violet-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-violet-500/30 shadow-lg',
      iconBg: 'bg-violet-500',
    },
  },
  {
    type: 'VA',
    label: 'Virtual Account',
    icon: Banknote,
    methods: [
      { code: 'BCAVA', label: 'BCA' },
      { code: 'BNIVA', label: 'BNI' },
      { code: 'BRIVA', label: 'BRI' },
      { code: 'PERMATAVA', label: 'Permata' },
    ],
    color: {
      sel: 'border-amber-400 bg-amber-500/15',
      unsel: 'border-white/10 bg-white/[0.03]',
      glow: 'shadow-amber-500/30 shadow-lg',
      iconBg: 'bg-amber-500',
    },
  },
]

const METHOD_MIN_AMOUNTS: Record<string, number> = {
  QRIS: 500, GOPAY: 500, DANA: 1000, OVO: 1000, SHOPEEPAY: 1000, LINKAJA: 1000,
  BCAVA: 10000, BNIVA: 10000, BRIVA: 10000, PERMATAVA: 10000, MUAMALATVA: 10000,
}

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
  userId,
  email,
  planName = 'Elite Pro',
  amount = 25000,
  plan = 'PRO',
  durationMonths = 1,
}: PaymentModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const [showManualTransfer, setShowManualTransfer] = useState(false);

  const canPay = selectedMethod !== null && !paying && !paid;

  const getMethodsForCategory = (catType: string) => {
    const cat = PAYMENT_CATEGORIES.find(c => c.type === catType);
    return cat?.methods || [];
  };

  const isBelowMin = (methodCode: string) => {
    const min = METHOD_MIN_AMOUNTS[methodCode];
    return min ? amount < min : false;
  };

  const getSelectedCategoryData = () => {
    return PAYMENT_CATEGORIES.find(c => c.type === selectedCategory);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCategorySelect = (catType: string) => {
    if (selectedCategory === catType) {
      setSelectedCategory(null);
      setSelectedMethod(null);
    } else {
      setSelectedCategory(catType);
      const methods = getMethodsForCategory(catType);
      const validMethod = methods.find(m => !isBelowMin(m.code));
      setSelectedMethod(validMethod?.code || null);
    }
    setPayError('');
  };

  const handleMethodSelect = (methodCode: string) => {
    if (isBelowMin(methodCode)) {
      setPayError(`Min. pembayaran ${methodCode} adalah ${formatRupiah(METHOD_MIN_AMOUNTS[methodCode])}`);
      return;
    }
    setSelectedMethod(methodCode);
    setPayError('');
  };

  // MAIN: Create SakuraPay order → redirect to gateway
  const handlePay = async () => {
    if (!selectedMethod) return;
    setPaying(true);
    setPayError('');

    try {
      const invoiceNumber = `LUX-${plan}-${Date.now()}`;
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          plan,
          durationMonths,
          paymentMethod: selectedMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.paymentUrl) {
        throw new Error(data.error || data.details || 'Gagal membuat pesanan');
      }

      // Redirect to SakuraPay gateway
      window.open(data.paymentUrl, '_blank');
      setPaying(false);
      setPaid(true);
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaying(false);
      setPayError(error.message || 'Gagal membuat pembayaran. Coba lagi atau gunakan Transfer Manual.');
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
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-purple-500/10 to-pink-500/20 blur-xl rounded-3xl" />
          <div className="absolute inset-0 shadow-[0_0_40px_rgba(138,43,226,0.3)] rounded-3xl" />

          {/* Main Card */}
          <div className="relative bg-[#0A0A0A]/95 border border-purple-500/30 rounded-2xl overflow-hidden">
            {/* Animated Border */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-pulse" />
            </div>

            {/* Header */}
            <div className="relative p-6 border-b border-purple-500/20">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600" />

              <div className="flex items-center justify-between">
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-bold tracking-widest text-purple-400 mb-1"
                  >
                    UPGRADE MEMBERSHIP
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white"
                  >
                    {paid ? 'Pembayaran Diproses' : 'Pilih Metode Pembayaran'}
                  </motion.h2>
                  <p className="text-purple-300/70 text-xs mt-1">
                    {paid ? 'Selesaikan pembayaran di tab baru' : `${planName} — ${formatRupiah(amount)}`}
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
                    <p className="text-lg font-bold text-emerald-300">Pesanan Dibuat!</p>
                    <p className="text-sm text-white/60 mt-1">
                      Selesaikan pembayaran di tab yang baru dibuka
                    </p>
                  </div>
                </motion.div>
              )}

              {!paid && (
                <>
                  {/* ===== STEP 1: CATEGORY SELECTION ===== */}
                  <div className="space-y-3">
                    <p className="text-xs text-purple-300 font-medium flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Langkah 1 — Pilih Kategori
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.type;
                        const Icon = cat.icon;
                        return (
                          <button
                            type="button"
                            key={cat.type}
                            onClick={() => handleCategorySelect(cat.type)}
                            className={`
                              relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200
                              cursor-pointer active:scale-[0.96]
                              ${isSelected
                                ? `${cat.color.sel} ${cat.color.glow}`
                                : `${cat.color.unsel} hover:border-white/20`
                              }
                            `}
                          >
                            <div className={`p-2 rounded-lg transition-colors ${isSelected ? cat.color.iconBg : 'bg-white/5'}`}>
                              <Icon className={`w-4 h-4 transition-colors ${isSelected ? 'text-white' : 'text-white/40'}`} />
                            </div>
                            <span className={`text-[10px] font-semibold transition-colors ${
                              isSelected ? 'text-white' : 'text-white/50'
                            }`}>
                              {cat.label}
                            </span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                              >
                                <Check className="w-2.5 h-2.5 text-white" />
                              </motion.div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ===== STEP 2: SPECIFIC METHOD ===== */}
                  {selectedCategory && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-xs text-purple-300 font-medium flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Langkah 2 — Pilih Metode
                      </p>
                      <div className="space-y-1.5">
                        {getMethodsForCategory(selectedCategory).map((method) => {
                          const isSelected = selectedMethod === method.code;
                          const belowMin = isBelowMin(method.code);
                          const catData = getSelectedCategoryData();
                          return (
                            <button
                              type="button"
                              key={method.code}
                              onClick={() => handleMethodSelect(method.code)}
                              disabled={belowMin}
                              className={`
                                w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200
                                cursor-pointer active:scale-[0.98]
                                ${isSelected
                                  ? `${catData?.color.sel || ''}`
                                  : belowMin
                                    ? 'border-white/5 bg-white/[0.01] opacity-35 cursor-not-allowed'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                }
                              `}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/20'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                              </div>
                              <span className={`text-sm font-medium ${
                                isSelected ? 'text-white' : 'text-white/60'
                              }`}>
                                {method.label}
                              </span>
                              {belowMin && (
                                <span className="ml-auto text-[10px] text-amber-400">Min. {formatRupiah(METHOD_MIN_AMOUNTS[method.code])}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

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

                  {/* ===== MAIN PAY BUTTON — SakuraPay Gateway ===== */}
                  <motion.button
                    whileHover={canPay ? { scale: 1.01 } : {}}
                    whileTap={canPay ? { scale: 0.98 } : {}}
                    onClick={handlePay}
                    disabled={!canPay}
                    className={`
                      w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                      ${canPay
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 cursor-pointer'
                        : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
                      }
                    `}
                  >
                    {paying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Membuat Pesanan...
                      </>
                    ) : !selectedMethod ? (
                      <>
                        <Lock className="w-5 h-5" />
                        Pilih Metode Pembayaran
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-5 h-5" />
                        Bayar Sekarang — {formatRupiah(amount)}
                      </>
                    )}
                  </motion.button>

                  {selectedMethod && !payError && (
                    <p className="text-[10px] text-center text-white/25">
                      Anda akan dialihkan ke halaman pembayaran SakuraPay
                    </p>
                  )}

                  {/* Security Badge */}
                  <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <Shield className="w-3 h-3" />
                    Pembayaran aman & terenkripsi via SakuraPay
                  </div>

                  {/* ===== MANUAL TRANSFER FALLBACK (collapsed, secondary) ===== */}
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowManualTransfer(!showManualTransfer)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Banknote className="w-3 h-3" />
                        Transfer Manual (Cadangan)
                      </span>
                      <span>{showManualTransfer ? '▲' : '▼'}</span>
                    </button>

                    <AnimatePresence>
                      {showManualTransfer && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1">
                            <div className="bg-white/[0.03] rounded-lg p-3 space-y-3">
                              <p className="text-[10px] text-white/30 text-center">
                                Gunakan hanya jika pembayaran otomatis gagal
                              </p>
                              <div className="text-center space-y-2">
                                <div>
                                  <p className="text-xs text-white/40">Bank Jago (542)</p>
                                  <div className="flex items-center justify-center gap-2 mt-1">
                                    <p className="text-base font-bold text-white font-mono">105668597393</p>
                                    <button
                                      onClick={() => handleCopy('105668597393', 'bank')}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                    >
                                      {copied === 'bank' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-white/50">a.n. RIZQI AKBAR PRATAMA</p>
                                </div>
                                <a
                                  href={`https://t.me/Risxyiee?text=${encodeURIComponent(`Halo admin, saya mau konfirmasi pembayaran LuxTrade paket ${planName} (${formatRupiah(amount)}). Terima kasih.`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0088cc]/20 text-[#0088cc] text-[11px] font-medium hover:bg-[#0088cc]/30 transition-colors"
                                >
                                  <Smartphone className="w-3 h-3" />
                                  Konfirmasi via Telegram
                                </a>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
