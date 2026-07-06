'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Send, ArrowRight, MessageCircle, Instagram, Phone, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/contexts/LanguageContext'
import { toast } from 'sonner'

export default function ContactPage() {
  const { language } = useLanguage()
  const isEnglish = language === 'en'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Construct mailto link with form data
      const subject = encodeURIComponent(`[LuxTrade Contact] ${formData.subject}`)
      const body = encodeURIComponent(
        `Name: ${formData.name}\n` +
        `Email: ${formData.email}\n\n` +
        `Message:\n${formData.message}`
      )
      
      // Open email client
      window.open(`mailto:luxtradee@gmail.com?subject=${subject}&body=${body}`, '_self')
      
      // Show success message
      toast.success(isEnglish ? 'Opening email client...' : 'Membuka aplikasi email...')
      
      // Clear form
      setFormData({ name: '', email: '', subject: '', message: '' })
    } catch (error) {
      toast.error(isEnglish ? 'Failed to open email client' : 'Gagal membuka aplikasi email')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white">
      {/* Partikel Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="LuxTrade Logo"
                width={40}
                height={40}
                className="rounded-xl shadow-lg"
              />
              <div>
                <Link href="/" className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                  LuxTrade
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/auth/login">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 font-semibold backdrop-blur-sm">
                  {isEnglish ? 'Login' : 'Masuk'}
                </Button>
              </Link>
              <Link href="/auth/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button className="h-10 px-6 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-sm">
                    {isEnglish ? 'Sign Up' : 'Daftar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Mail className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
              <span className="bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                {isEnglish ? 'Get in Touch' : 'Hubungi Kami'}
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
              {isEnglish
                ? 'Have questions or feedback? We\'d love to hear from you. Send us a message and we\'ll get back to you as soon as possible.'
                : 'Punya pertanyaan atau masukan? Kami senang mendengar dari Anda. Kirimkan pesan dan kami akan segera merespons.'}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-8">
              <CardContent className="p-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white font-semibold">
                      {isEnglish ? 'Your Name' : 'Nama Anda'} *
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={isEnglish ? 'Enter your name' : 'Masukkan nama Anda'}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500 focus:ring-purple-500/20"
                    />
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-semibold">
                      {isEnglish ? 'Email Address' : 'Alamat Email'} *
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={isEnglish ? 'Enter your email' : 'Masukkan email Anda'}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500 focus:ring-purple-500/20"
                    />
                  </div>

                  {/* Subject Field */}
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-white font-semibold">
                      {isEnglish ? 'Subject' : 'Subjek'} *
                    </Label>
                    <Input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder={isEnglish ? 'What is this about?' : 'Apa yang ingin Anda sampaikan?'}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500 focus:ring-purple-500/20"
                    />
                  </div>

                  {/* Message Field */}
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white font-semibold">
                      {isEnglish ? 'Message' : 'Pesan'} *
                    </Label>
                    <Textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      placeholder={isEnglish ? 'Write your message here...' : 'Tulis pesan Anda di sini...'}
                      rows={6}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500 focus:ring-purple-500/20 resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-xl text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span className="ml-2">
                          {isEnglish ? 'Sending...' : 'Mengirim...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        {isEnglish ? 'Send Message' : 'Kirim Pesan'}
                      </>
                    )}
                  </Button>

                  <p className="text-center text-white/40 text-sm">
                    {isEnglish
                      ? 'This will open your default email client to send the message.'
                      : 'Ini akan membuka aplikasi email default Anda untuk mengirim pesan.'}
                  </p>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Alternative Contact Methods */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="backdrop-blur-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-8 text-center">
              <h2 className="text-2xl font-extrabold text-white mb-6">
                {isEnglish ? 'Other Ways to Connect' : 'Cara Lain untuk Terhubung'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Direct Email */}
                <a
                  href="mailto:luxtradee@gmail.com"
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">Email</p>
                    <p className="text-white/60 text-sm">luxtradee@gmail.com</p>
                  </div>
                </a>

                {/* Discord */}
                <a
                  href="https://discord.gg/HDUNAsnW2R"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#5865F2]/30 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5865F2] to-[#7289DA] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">Discord</p>
                    <p className="text-white/60 text-sm">LuxTrade Server</p>
                  </div>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/luxtrade.web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-pink-500/30 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Instagram className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">Instagram</p>
                    <p className="text-white/60 text-sm">@luxtrade.web</p>
                  </div>
                </a>

                {/* Phone */}
                <a
                  href="tel:+6285712054394"
                  className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">Telepon</p>
                    <p className="text-white/60 text-sm">+62 857-1205-4394</p>
                  </div>
                </a>

                {/* Business Address */}
                <div className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">Alamat Usaha</p>
                    <p className="text-white/60 text-sm">Jakarta, Indonesia</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/40 text-sm font-medium">
            © {new Date().getFullYear()} LuxTrade. All rights reserved.
          </p>
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            <Link href="/disclaimer" className="text-white/40 hover:text-white text-sm transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="text-white/40 hover:text-white text-sm transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-white/40 hover:text-white text-sm transition-colors">Terms of Service</Link>
            <Link href="/refund-policy" className="text-white/40 hover:text-white text-sm transition-colors">Refund Policy</Link>
            <Link href="/faq" className="text-white/40 hover:text-white text-sm transition-colors">FAQ</Link>
            <Link href="/contact" className="text-white/40 hover:text-white text-sm transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
