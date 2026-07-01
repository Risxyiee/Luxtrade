'use client'

import React from 'react'

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
      <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
      <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
      <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
      <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '25%', left: '5%', animationDuration: '4.5s' }} />
      <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" style={{ top: '35%', left: '12%', animationDuration: '3s' }} />
      <div className="absolute w-4 h-4 bg-purple-500/35 rounded-full animate-ping" style={{ top: '30%', left: '22%', animationDuration: '4.5s' }} />
      <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '50%', left: '8%', animationDuration: '4s' }} />
      <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '70%', left: '10%', animationDuration: '4.2s' }} />
      <div className="absolute w-2 h-2 bg-blue-400/45 rounded-full animate-pulse" style={{ top: '78%', left: '20%', animationDuration: '3.5s' }} />
      <div className="absolute w-2 h-2 bg-purple-500/50 rounded-full animate-pulse" style={{ top: '20%', left: '78%', animationDuration: '4.2s' }} />
      <div className="absolute w-4 h-4 bg-blue-500/35 rounded-full animate-ping" style={{ top: '7%', left: '88%', animationDuration: '3.2s' }} />
      <div className="absolute w-2 h-2 bg-purple-300/55 rounded-full animate-pulse" style={{ top: '14%', left: '92%', animationDuration: '2.8s' }} />
      <div className="absolute w-3 h-3 bg-purple-500/45 rounded-full animate-ping" style={{ top: '62%', left: '78%', animationDuration: '4.2s' }} />
      <div className="absolute w-2 h-2 bg-blue-400/35 rounded-full animate-pulse" style={{ top: '50%', left: '85%', animationDuration: '4.5s' }} />
      <div className="absolute w-4 h-4 bg-purple-400/40 rounded-full animate-ping" style={{ top: '58%', left: '90%', animationDuration: '3s' }} />
      <div className="absolute w-2 h-2 bg-purple-300/50 rounded-full animate-pulse" style={{ top: '85%', left: '80%', animationDuration: '3.8s' }} />
    </div>
  )
}