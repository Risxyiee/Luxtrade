'use client'

import React from 'react'

/*
  Animated SVG backgrounds for landing page sections.
  Each export is a lightweight, single-purpose SVG with CSS animations.
  Placed as absolute background inside each section.
*/

/* -- 1. Hero -- floating candlestick chart */
export function HeroSvg() {
  return (
    <svg
      className="absolute right-0 top-0 w-[500px] h-full opacity-[0.04] pointer-events-none hidden lg:block"
      viewBox="0 0 500 600" fill="none" aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-candle-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {[80, 140, 200, 260, 320, 380].map((x, i) => {
        const h = 60 + Math.sin(i * 1.2) * 40
        const y = 300 - h / 2
        const isGreen = i % 2 === 0
        return (
          <g key={i}>
            <line x1={x} y1={y - 15} x2={x} y2={y + h + 15} stroke={isGreen ? '#3b82f6' : '#f0f2ff'} strokeWidth="1.5" />
            <rect
              x={x - 8} y={y}
              width="16" height={h}
              rx="3"
              fill={isGreen ? 'url(#hero-candle-g)' : 'none'}
              stroke={isGreen ? '#3b82f6' : '#f0f2ff'}
              strokeWidth="1.5"
              opacity={0.8}
            >
              <animate attributeName="y" values={`${y};${y - 10};${y}`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
            </rect>
          </g>
        )
      })}
      <polyline
        points="60,400 140,350 220,380 300,280 380,300 460,200"
        stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeDasharray="6 4"
        opacity="0.5"
      >
        <animate attributeName="stroke-dashoffset" values="40;0" dur="3s" repeatCount="indefinite" />
      </polyline>
    </svg>
  )
}

/* -- 2. Stats -- pulsing data nodes */
export function StatsSvg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none"
      viewBox="0 0 800 100" fill="none" aria-hidden="true"
    >
      {[100, 250, 400, 550, 700].map((cx, i) => (
        <g key={i}>
          <circle cx={cx} cy="50" r="3" fill="#3b82f6">
            <animate attributeName="r" values="3;5;3" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.5;1" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
          {i < 4 && (
            <line x1={cx + 6} y1="50" x2={cx + 144} y2="50" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="4 6">
              <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
            </line>
          )}
        </g>
      ))}
    </svg>
  )
}

/* -- 3. How It Works -- flowing connection path */
export function HowItWorksSvg() {
  return (
    <svg
      className="absolute left-0 top-0 w-[300px] h-full opacity-[0.04] pointer-events-none hidden lg:block"
      viewBox="0 0 300 600" fill="none" aria-hidden="true"
    >
      <path
        d="M150,0 C150,100 50,150 150,200 C250,250 150,300 150,400 C150,500 50,550 150,600"
        stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeDasharray="8 6"
      >
        <animate attributeName="stroke-dashoffset" values="56;0" dur="4s" repeatCount="indefinite" />
      </path>
      {[0, 200, 400, 600].map((y, i) => (
        <circle key={i} cx="150" cy={y} r="4" fill="#3b82f6" opacity="0.6">
          <animate attributeName="r" values="4;6;4" dur="3s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

/* -- 4. Tutorial -- orbiting rings */
export function TutorialSvg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none"
      viewBox="0 0 400 400" fill="none" aria-hidden="true"
    >
      <g transform="translate(200,200)">
        <circle r="120" stroke="#3b82f6" strokeWidth="0.8" fill="none" strokeDasharray="10 8">
          <animateTransform attributeName="transform" type="rotate" values="0;360" dur="30s" repeatCount="indefinite" />
        </circle>
        <circle r="80" stroke="#60a5fa" strokeWidth="0.5" fill="none" strokeDasharray="6 10">
          <animateTransform attributeName="transform" type="rotate" values="360;0" dur="20s" repeatCount="indefinite" />
        </circle>
        <circle r="3" fill="#3b82f6">
          <animateMotion dur="30s" repeatCount="indefinite" path="M120,0 A120,120 0 1,1 -120,0 A120,120 0 1,1 120,0" />
        </circle>
      </g>
    </svg>
  )
}

/* -- 5. Features -- geometric mesh grid */
export function FeaturesSvg() {
  const dots: React.ReactNode[] = []
  const lines: React.ReactNode[] = []
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = col * 110 + 40
      const cy = row * 110 + 30
      dots.push(
        <circle key={`d-${row}-${col}`} cx={cx} cy={cy} r="1.5" fill="#3b82f6">
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur={`${3 + (row + col) * 0.2}s`}
            begin={`${(row + col) * 0.1}s`}
            repeatCount="indefinite"
          />
        </circle>
      )
      if (col < 7) {
        lines.push(
          <line key={`l-${row}-${col}`} x1={cx} y1={cy} x2={cx + 110} y2={cy} stroke="#3b82f6" strokeWidth="0.3" />
        )
      }
    }
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
      viewBox="0 0 800 600" fill="none" aria-hidden="true"
    >
      {dots}
      {lines}
    </svg>
  )
}

/* -- 6. CTA -- rocket launch trail */
export function CtaSvg() {
  return (
    <svg
      className="absolute right-0 top-0 w-[350px] h-full opacity-[0.04] pointer-events-none hidden lg:block"
      viewBox="0 0 350 500" fill="none" aria-hidden="true"
    >
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,10;0,-10;0,10" dur="4s" repeatCount="indefinite" />
        <path d="M175,200 L185,240 L175,260 L165,240 Z" fill="#3b82f6" opacity="0.6" />
        <path d="M165,240 L155,250 L175,245 L195,250 L185,240" fill="#3b82f6" opacity="0.4" />
        <path d="M170,260 L175,290 L180,260" fill="#f0f2ff" opacity="0.3">
          <animate attributeName="d" values="M170,260 L175,290 L180,260;M172,260 L175,300 L178,260;M170,260 L175,290 L180,260" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="0.6s" repeatCount="indefinite" />
        </path>
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={175} cy="300" r="2" fill="#3b82f6">
          <animate attributeName="cy" values="290;400" dur={`${1.5 + i * 0.3}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0" dur={`${1.5 + i * 0.3}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
          <animate attributeName="r" values="2;0.5" dur={`${1.5 + i * 0.3}s`} begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <line x1="175" y1="300" x2="175" y2="450" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 6" opacity="0.3">
        <animate attributeName="stroke-dashoffset" values="20;0" dur="2s" repeatCount="indefinite" />
      </line>
    </svg>
  )
}

/* -- 7. Pricing -- floating coin particles */
export function PricingSvg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none"
      viewBox="0 0 800 800" fill="none" aria-hidden="true"
    >
      {[
        { cx: 100, cy: 150, delay: 0 },
        { cx: 700, cy: 200, delay: 0.8 },
        { cx: 400, cy: 100, delay: 1.6 },
        { cx: 200, cy: 700, delay: 0.4 },
        { cx: 650, cy: 650, delay: 1.2 },
      ].map((c, i) => (
        <g key={i}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`${c.cx},${c.cy};${c.cx},${c.cy - 20};${c.cx},${c.cy}`}
            dur={`${4 + i * 0.5}s`}
            begin={`${c.delay}s`}
            repeatCount="indefinite"
          />
          <circle r="8" stroke="#3b82f6" strokeWidth="1" fill="none" />
          <text x="0" y="4" textAnchor="middle" fill="#3b82f6" fontSize="8" fontFamily="monospace">$</text>
        </g>
      ))}
    </svg>
  )
}

/* -- 8. Promo -- tag/label float */
export function PromoSvg() {
  return (
    <svg
      className="absolute right-0 top-0 w-[250px] h-full opacity-[0.04] pointer-events-none hidden md:block"
      viewBox="0 0 250 200" fill="none" aria-hidden="true"
    >
      <g>
        <animateTransform attributeName="transform" type="rotate" values="-5;5;-5" dur="6s" repeatCount="indefinite" />
        <rect x="75" y="40" width="100" height="50" rx="8" stroke="#3b82f6" strokeWidth="1" fill="#3b82f6" fillOpacity="0.1" />
        <line x1="175" y1="50" x2="190" y2="40" stroke="#3b82f6" strokeWidth="1" />
        <line x1="175" y1="80" x2="190" y2="90" stroke="#3b82f6" strokeWidth="1" />
        <circle cx="190" cy="40" r="4" fill="#3b82f6" fillOpacity="0.3" />
        <circle cx="190" cy="90" r="4" fill="#3b82f6" fillOpacity="0.3" />
      </g>
    </svg>
  )
}

/* -- 9. FAQ -- question mark pulse */
export function FaqSvg() {
  return (
    <svg
      className="absolute right-0 top-0 w-[300px] h-full opacity-[0.03] pointer-events-none hidden lg:block"
      viewBox="0 0 300 600" fill="none" aria-hidden="true"
    >
      {[100, 300, 500].map((cy, i) => (
        <g key={i}>
          <circle cx="150" cy={cy} r="20" stroke="#3b82f6" strokeWidth="0.8" fill="none">
            <animate attributeName="r" values="20;24;20" dur={`${3 + i}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
          </circle>
          <text x="150" y={cy + 6} textAnchor="middle" fill="#3b82f6" fontSize="18" fontFamily="sans-serif" fontWeight="300">?</text>
          <animate attributeName="opacity" values="0.5;1;0.5" dur={`${3 + i}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
        </g>
      ))}
    </svg>
  )
}

/* -- 10. Roadmap -- journey path with milestones */
export function RoadmapSvg() {
  return (
    <svg
      className="absolute left-0 bottom-0 w-full h-[200px] opacity-[0.03] pointer-events-none"
      viewBox="0 0 800 200" fill="none" aria-hidden="true"
    >
      <path
        d="M0,100 C100,100 150,50 200,80 C250,110 300,150 400,120 C500,90 550,40 600,70 C650,100 700,130 800,100"
        stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeDasharray="8 6"
      >
        <animate attributeName="stroke-dashoffset" values="56;0" dur="5s" repeatCount="indefinite" />
      </path>
      {[0, 200, 400, 600, 800].map((x, i) => (
        <circle key={i} cx={x} cy={i === 0 ? 100 : i === 1 ? 80 : i === 2 ? 120 : i === 3 ? 70 : 100} r="4" fill="#3b82f6">
          <animate attributeName="r" values="4;6;4" dur="2.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

/* -- 11. Newsletter -- envelope pulse */
export function NewsletterSvg() {
  return (
    <svg
      className="absolute left-0 top-0 w-[200px] h-full opacity-[0.04] pointer-events-none hidden lg:block"
      viewBox="0 0 200 300" fill="none" aria-hidden="true"
    >
      <g>
        <animateTransform attributeName="transform" type="translate" values="100,150;100,140;100,150" dur="4s" repeatCount="indefinite" />
        <rect x="60" y="125" width="80" height="55" rx="5" stroke="#3b82f6" strokeWidth="1" fill="#3b82f6" fillOpacity="0.08" />
        <path d="M60,125 L100,155 L140,125" stroke="#3b82f6" strokeWidth="1" fill="none" />
        <line x1="50" y1="150" x2="45" y2="140" stroke="#3b82f6" strokeWidth="0.5" opacity="0.5">
          <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite" />
        </line>
        <line x1="45" y1="155" x2="38" y2="145" stroke="#3b82f6" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="opacity" values="0;0.3;0" dur="2s" begin="0.3s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  )
}
