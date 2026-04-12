import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import nodemailer from 'nodemailer'

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  companyOrProject: z.string().max(200).optional().default(''),
  message: z.string().min(10).max(2000),
})

/**
 * Build a nodemailer transporter from environment variables.
 *
 * Required env vars for email delivery:
 *   SMTP_HOST     — SMTP server hostname (e.g. smtp.gmail.com)
 *   SMTP_PORT     — SMTP port (default: 587)
 *   SMTP_USER     — SMTP username / login email
 *   SMTP_PASS     — SMTP password / app password
 *   SMTP_FROM     — From address (e.g. "AmarktAI Network <noreply@amarktai.network>")
 *   CONTACT_EMAIL — Recipient address (default: amarktainetwork@gmail.com)
 *
 * When SMTP_HOST is not set, email delivery is skipped but the submission
 * is still saved to the database so no enquiry is ever lost.
 */
function buildTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function POST(request: NextRequest) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let data: z.infer<typeof schema>
  try {
    data = schema.parse(rawBody)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 1. Persist to DB (always — never lose an enquiry)
  try {
    await prisma.contactSubmission.create({
      data: {
        name: data.name,
        email: data.email,
        companyOrProject: data.companyOrProject,
        message: data.message,
      },
    })
  } catch (err) {
    console.error('[contact] DB save failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 2. Send email notification (best-effort — do not block on failure)
  const recipient = process.env.CONTACT_EMAIL ?? 'amarktainetwork@gmail.com'
  const transporter = buildTransporter()
  if (transporter) {
    // SMTP_FROM should always be set alongside SMTP_HOST; fall back to a clearly
    // labelled address so the From header is never empty or malformed.
    const from = process.env.SMTP_FROM ?? 'AmarktAI Network <noreply@amarktai.network>'
    const subject = `[AmarktAI Enquiry] ${data.name}${data.companyOrProject ? ` — ${data.companyOrProject}` : ''}`
    const text = [
      `Name:         ${data.name}`,
      `Email:        ${data.email}`,
      `Organisation: ${data.companyOrProject || '—'}`,
      '',
      `Message:`,
      data.message,
      '',
      `---`,
      `Submitted: ${new Date().toISOString()}`,
      `Source: AmarktAI Network contact form`,
    ].join('\n')

    try {
      await transporter.sendMail({ from, to: recipient, subject, text })
    } catch (err) {
      // Log but do not fail the request — submission is already saved
      console.error('[contact] Email delivery failed (submission saved to DB):', err)
    }
  } else {
    // No SMTP configured — log so the operator knows
    console.info(
      `[contact] No SMTP configured — submission saved to DB. Configure SMTP_HOST/SMTP_USER/SMTP_PASS to enable email delivery to ${recipient}`,
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

