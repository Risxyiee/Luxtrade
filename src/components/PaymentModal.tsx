'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Send, Banknote, Clock, Shield } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  email?: string;
}

interface PaymentDetails {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
}

export default function PaymentModal({ isOpen, onClose, userId, email }: PaymentModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    bankName: 'Bank Jago',
    accountNumber: '104051474194',
    accountHolder: 'RIZQI AKBAR PRATAMA',
    amount: 49000,
  });
  const [tgLink, setTgLink] = useState('');
  const [adminTelegram, setAdminTelegram] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchPaymentDetails();
    }
  }, [isOpen, userId, email]);

  const fetchPaymentDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userId || 'guest-' + Date.now(), 
          email: email || 'guest@example.com' 
        }),
      });
      const data = await response.json();
      if (data.success) {
        setPaymentDetails(data.bankDetails);
        setTgLink(data.tgLink);
        setAdminTelegram(data.adminTelegram || '');
      }
    } catch (error) {
      console.error('Failed to fetch payment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
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
          className="relative w-full max-w-md"
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
                    ELITE PRO MEMBERSHIP
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white"
                  >
                    Upgrade Account
                  </motion.h2>
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
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Price Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600/20 via-pink-500/20 to-purple-600/20 border border-purple-500/30"
                  >
                    <div className="text-sm text-purple-300 mb-1">Total Pembayaran</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                      {formatCurrency(paymentDetails.amount)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">/bulan</div>
                  </motion.div>

                  {/* Step 1: Transfer */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">1</span>
                      Transfer ke Rekening Berikut
                    </div>

                    {/* Bank Name */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Bank</div>
                        <div className="font-bold text-white">{paymentDetails.bankName}</div>
                      </div>
                    </div>

                    {/* Account Number */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Nomor Rekening</div>
                        <div className="font-bold text-white font-mono">{paymentDetails.accountNumber}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(paymentDetails.accountNumber, 'account')}
                        className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                      >
                        {copied === 'account' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                    </div>

                    {/* Account Holder */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Atas Nama</div>
                        <div className="font-bold text-white">{paymentDetails.accountHolder}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(paymentDetails.accountHolder, 'holder')}
                        className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
                      >
                        {copied === 'holder' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                    </div>
                  </motion.div>

                  {/* Step 2: Confirm */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold">
                      <span className="w-5 h-5 rounded-full bg-[#0088cc]/20 text-[#0088cc] text-xs flex items-center justify-center font-bold">2</span>
                      Konfirmasi via Telegram
                    </div>
                  </motion.div>

                  {/* Info */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20"
                  >
                    <Clock className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <div className="text-xs text-white/60">
                      Proses aktivasi 1-5 menit setelah konfirmasi pembayaran
                    </div>
                  </motion.div>

                  {/* Telegram Button */}
                  <motion.a
                    href={tgLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-gradient-to-r from-[#0088cc] to-[#00a8e8] hover:from-[#0077b3] hover:to-[#0096d6] text-white font-bold text-lg shadow-lg shadow-[#0088cc]/30 transition-all"
                  >
                    {/* Telegram Icon */}
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    Konfirmasi via Telegram
                  </motion.a>

                  {/* Admin info */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55 }}
                    className="text-center"
                  >
                    <p className="text-xs text-white/40">
                      Akan terhubung ke{' '}
                      <span className="text-[#0088cc] font-semibold">{adminTelegram || '@Risxyiee'}</span>
                    </p>
                  </motion.div>

                  {/* Security Badge */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-2 text-xs text-white/40"
                  >
                    <Shield className="w-3 h-3" />
                    Pembayaran aman & terenkripsi
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
