import nodemailer from 'nodemailer'

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

export async function send(to: string, subject: string, html: string): Promise<void> {
  await transport.sendMail({ from: 'notifications@example.com', to, subject, html })
}
