import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'newsletter.json')

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readEmails(): { email: string; subscribedAt: string }[] {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeEmails(emails: { email: string; subscribedAt: string }[]) {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(emails, null, 2))
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const trimmed = email.trim()

    if (!isValidEmail(trimmed)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const emails = readEmails()
    emails.push({ email: trimmed, subscribedAt: new Date().toISOString() })
    writeEmails(emails)

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!'
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}