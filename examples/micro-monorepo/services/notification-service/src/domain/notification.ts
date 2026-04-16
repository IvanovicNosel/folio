// VIOLATION: domain layer importing nodemailer directly
// The domain should call infra/mailer.ts, not the SDK.
// No ADR. No discussion. Just drift.
import nodemailer from 'nodemailer'

export type NotificationType = 'order-confirmed' | 'order-shipped' | 'order-cancelled'

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

export async function notifyOrderConfirmed(email: string, orderId: string): Promise<void> {
  await transport.sendMail({
    from: 'notifications@example.com',
    to: email,
    subject: 'Your order has been confirmed',
    html: `<p>Order <strong>${orderId}</strong> is confirmed.</p>`,
  })
}

export async function notifyOrderShipped(email: string, orderId: string, trackingCode: string): Promise<void> {
  await transport.sendMail({
    from: 'notifications@example.com',
    to: email,
    subject: 'Your order has shipped',
    html: `<p>Order <strong>${orderId}</strong> shipped. Tracking: ${trackingCode}</p>`,
  })
}

export async function notifyOrderCancelled(email: string, orderId: string): Promise<void> {
  await transport.sendMail({
    from: 'notifications@example.com',
    to: email,
    subject: 'Your order has been cancelled',
    html: `<p>Order <strong>${orderId}</strong> has been cancelled.</p>`,
  })
}
