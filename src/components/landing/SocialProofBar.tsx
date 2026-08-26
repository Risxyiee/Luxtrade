'use client'

import React from 'react'

const logos = [
  { name: 'FundedElite', style: 'tracking-tight' },
  { name: 'FINOTIVE FUNDING', style: 'tracking-wider italic font-light' },
  { name: 'WeMasterTrade', style: 'tracking-wide font-extrabold uppercase text-sm' },
  { name: 'midtrans', style: 'tracking-tight', hasBadge: true },
]

export default function SocialProofBar() {
  return (
    <section className="py-16 border-y border-white/5 bg-[#070710] relative z-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-10">
        <p className="text-sm text-gray-500 uppercase tracking-widest font-mono text-center">
          Dipercaya oleh trader yang melewati tantangan Prop Firm.
        </p>
        <div className="w-full overflow-hidden mask-gradient">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-16 pr-16">
                {logos.map((logo) => (
                  <div
                    key={`${dup}-${logo.name}`}
                    className={`text-1.25xl font-bold text-gray-500 transition-all opacity-40 cursor-pointer flex items-center gap-2 hover:text-white hover:opacity-100 hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.2)] text-[1.25rem] ${logo.style}`}
                  >
                    {logo.name === 'midtrans' ? (
                      <>
                        <span className="font-extrabold">mid</span>
                        <span className="font-light">trans</span>
                      </>
                    ) : logo.name}
                    {logo.hasBadge && (
                      <span className="verified-badge font-mono align-middle">Pembayaran Terverifikasi</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
