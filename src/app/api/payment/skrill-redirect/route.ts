import { NextResponse } from 'next/server'

export async function GET() {
  const skrillUrl = process.env.SKRILL_PAYMENT_URL || 'https://skrill.me/rq/RIZQI%20AKBAR/3/USD?key=vXcr_5kNitZJFVBnkmK0sakLnjB'
  return NextResponse.redirect(skrillUrl)
}
