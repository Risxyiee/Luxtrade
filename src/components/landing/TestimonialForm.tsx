'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X, Send, CheckCircle2, User, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface TestimonialFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  language?: 'id' | 'en'
}

export default function TestimonialForm({ isOpen, onClose, onSuccess, language = 'id' }: TestimonialFormProps) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [userName, setUserName] = useState('')
  const [role, setRole] = useState('')
  const [propFirmsPassed, setPropFirmsPassed] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setRating(5)
      setText('')
      setUserName('')
      setRole('')
      setPropFirmsPassed('0')
      setSubmitStatus('idle')
      setErrorMessage('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          text,
          user_name: userName || undefined,
          role: role || undefined,
          prop_firms_passed: propFirmsPassed ? parseInt(propFirmsPassed) : 0,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit testimonial')
      }

      setSubmitStatus('success')

      // Auto-close after success
      setTimeout(() => {
        onClose()
        onSuccess?.()
      }, 2000)
    } catch (error) {
      console.error('Error submitting testimonial:', error)
      setSubmitStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRatingLabel = (rating: number) => {
    const labels = {
      1: language === 'en' ? 'Poor' : 'Buruk',
      2: language === 'en' ? 'Fair' : 'Kurang',
      3: language === 'en' ? 'Good' : 'Bagus',
      4: language === 'en' ? 'Very Good' : 'Sangat Bagus',
      5: language === 'en' ? 'Excellent' : 'Sangat Bagus',
    }
    return labels[rating as keyof typeof labels] || ''
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-[#0a0a12] border border-white/10 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {language === 'en' ? 'Share Your Experience' : 'Bagikan Pengalaman Anda'}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {language === 'en'
                      ? 'Help other traders by sharing your experience with LuxTrade'
                      : 'Bantu trader lain dengan berbagi pengalaman Anda menggunakan LuxTrade'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Rating */}
                <div className="space-y-2">
                  <Label className="text-base">
                    {language === 'en' ? 'Your Rating' : 'Rating Anda'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= (hoverRating || rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {hoverRating > 0 && (
                      <span className="text-sm text-yellow-400 font-medium">
                        {getRatingLabel(hoverRating)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Name (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-sm text-gray-400">
                    {language === 'en' ? 'Name (optional)' : 'Nama (opsional)'}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input
                      id="userName"
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder={language === 'en' ? 'Your name' : 'Nama Anda'}
                      className="pl-10 bg-white/5 border-white/10"
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Role (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm text-gray-400">
                    {language === 'en' ? 'Role/Title (optional)' : 'Role/Posisi (opsional)'}
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input
                      id="role"
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder={language === 'en' ? 'e.g., Forex Trader, Jakarta' : 'misalnya, Forex Trader, Jakarta'}
                      className="pl-10 bg-white/5 border-white/10"
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Prop Firms Passed (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="propFirmsPassed" className="text-sm text-gray-400">
                    {language === 'en'
                      ? 'Prop Firms Passed (optional)'
                      : 'Prop Firm yang Dilulusi (opsional)'}
                  </Label>
                  <Input
                    id="propFirmsPassed"
                    type="number"
                    min="0"
                    max="50"
                    value={propFirmsPassed}
                    onChange={(e) => setPropFirmsPassed(e.target.value)}
                    placeholder="0"
                    className="bg-white/5 border-white/10"
                  />
                </div>

                {/* Testimonial Text */}
                <div className="space-y-2">
                  <Label htmlFor="text">
                    {language === 'en' ? 'Your Testimonial' : 'Testimoni Anda'}
                    <span className="text-red-400 ml-1">*</span>
                  </Label>
                  <Textarea
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'How has LuxTrade helped your trading? What did you like most? (min. 10 characters)'
                        : 'Bagaimana LuxTrade membantu trading Anda? Apa yang paling Anda suka? (min. 10 karakter)'
                    }
                    className="bg-white/5 border-white/10 min-h-[120px] resize-none"
                    maxLength={1000}
                    required
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{language === 'en' ? 'Min. 10 characters' : 'Min. 10 karakter'}</span>
                    <span>{text.length}/1000</span>
                  </div>
                </div>

                {/* Success Message */}
                <AnimatePresence>
                  {submitStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {language === 'en'
                          ? 'Thank you! Your testimonial has been submitted.'
                          : 'Terima kasih! Testimoni Anda telah dikirim.'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                  {submitStatus === 'error' && errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
                    >
                      {errorMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 border-white/20 hover:bg-white/5"
                    disabled={isSubmitting}
                  >
                    {language === 'en' ? 'Cancel' : 'Batal'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || text.length < 10 || text.length > 1000}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {language === 'en' ? 'Submitting...' : 'Mengirim...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        {language === 'en' ? 'Submit' : 'Kirim'}
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}