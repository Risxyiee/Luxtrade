'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X, Send, CheckCircle2, User, Briefcase, LogIn, Camera, Upload, Trash2, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'

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
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error' | 'need-login'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [isPhotoUploading, setIsPhotoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setRating(5)
      setText('')
      setUserName('')
      setRole('')
      setPropFirmsPassed('0')
      setSubmitStatus('idle')
      setErrorMessage('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoUrl(null)
      setIsPhotoUploading(false)
    }
  }, [isOpen])

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setSubmitStatus('error')
      setErrorMessage(language === 'en' ? 'Invalid file type. Use JPG, PNG, WebP, or GIF.' : 'Tipe file salah. Pakai JPG, PNG, WebP, atau GIF.')
      return
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSubmitStatus('error')
      setErrorMessage(language === 'en' ? 'File too large. Maximum 2MB.' : 'File terlalu besar. Maksimal 2MB.')
      return
    }

    setPhotoFile(file)
    setSubmitStatus('idle')
    setErrorMessage('')

    // Create preview
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }, [language])

  // Remove photo
  const handleRemovePhoto = useCallback(() => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Upload photo to server
  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null
    if (photoUrl) return photoUrl // Already uploaded

    setIsPhotoUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', photoFile)

      const response = await fetch('/api/testimonials/upload-photo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          setSubmitStatus('need-login')
          return null
        }
        throw new Error(data.error || 'Upload failed')
      }

      setPhotoUrl(data.url)
      return data.url
    } catch (error) {
      console.error('Photo upload error:', error)
      // Don't block submission if photo upload fails
      return null
    } finally {
      setIsPhotoUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      // Upload photo first if selected
      let uploadedPhotoUrl = photoUrl
      if (photoFile && !photoUrl) {
        uploadedPhotoUrl = await uploadPhoto()
      }

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
          profile_image_url: uploadedPhotoUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if unauthorized
        if (response.status === 401) {
          setSubmitStatus('need-login')
          setErrorMessage(data.error || (language === 'id' ? 'Silakan login terlebih dahulu' : 'Please login first'))
          return
        }
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
      5: language === 'en' ? 'Excellent' : 'Luar Biasa',
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
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
              {/* Need Login State */}
              {submitStatus === 'need-login' && (
                <div className="space-y-4">
                  <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                    <LogIn className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-white mb-2">
                      {language === 'en' ? 'Login Required' : 'Perlu Login Dulu'}
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      {language === 'en'
                        ? 'You need to be logged in to submit a testimonial. It\'s free and takes 30 seconds!'
                        : 'Anda perlu login untuk kirim testimoni. Gratis dan cuma 30 detik!'}
                    </p>
                    <Link href="/auth/signup" className="block">
                      <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90 text-base py-5">
                        <LogIn className="w-5 h-5 mr-2" />
                        {language === 'en' ? 'Sign Up Free' : 'Daftar Gratis'}
                      </Button>
                    </Link>
                    <div className="mt-3">
                      <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                        {language === 'en' ? 'Already have an account? Login' : 'Sudah punya akun? Login'}
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Normal Form */}
              {submitStatus !== 'need-login' && (
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
                      {(hoverRating > 0 || rating > 0) && (
                        <span className="text-sm text-yellow-400 font-medium">
                          {getRatingLabel(hoverRating || rating)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ===== PHOTO UPLOAD ===== */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-400">
                      <Camera className="w-4 h-4 inline mr-1.5" />
                      {language === 'en' ? 'Your Photo (optional)' : 'Foto Anda (opsional)'}
                    </Label>
                    <p className="text-xs text-gray-500 mb-2">
                      {language === 'en'
                        ? 'Upload your photo to show next to your testimonial. Max 2MB.'
                        : 'Upload foto Anda untuk ditampilkan di testimoni. Maks 2MB.'}
                    </p>

                    {!photoPreview ? (
                      /* Upload Area */
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
                          <ImagePlus className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                          {language === 'en' ? 'Click to upload photo' : 'Klik untuk upload foto'}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          JPG, PNG, WebP, GIF &bull; Max 2MB
                        </span>
                      </button>
                    ) : (
                      /* Photo Preview */
                      <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay with actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                          >
                            <Upload className="w-4 h-4 text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                        {/* Remove button (always visible) */}
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-red-500/60 transition-colors"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        {/* Uploading overlay */}
                        {isPhotoUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
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
                      disabled={isSubmitting || isPhotoUploading}
                    >
                      {language === 'en' ? 'Cancel' : 'Batal'}
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || isPhotoUploading || text.length < 10 || text.length > 1000}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:opacity-90"
                    >
                      {isSubmitting || isPhotoUploading ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {isPhotoUploading
                            ? (language === 'en' ? 'Uploading photo...' : 'Upload foto...')
                            : (language === 'en' ? 'Submitting...' : 'Mengirim...')}
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
