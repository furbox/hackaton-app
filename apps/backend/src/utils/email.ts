import { Resend } from 'resend';

const fromEmail = Bun.env.EMAIL_FROM || 'noreply@urloft.site';
const appUrl = Bun.env.APP_URL || 'http://localhost:5173';

function getResendClient() {
  if (!Bun.env.RESEND_API_KEY || Bun.env.RESEND_API_KEY === 'your-resend-api-key') {
    return null;
  }
  return new Resend(Bun.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${appUrl}/auth/verify?token=${token}`;

  const resend = getResendClient();
  if (!resend) {
    console.log('📧 [DEV MODE] Verification email:', { to, verifyUrl });
    return;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Verify your email - urloft.site',
      html: `
        <h1>Welcome to urloft.site!</h1>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verifyUrl}">${verifyUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${appUrl}/auth/reset?token=${token}`;

  const resend = getResendClient();
  if (!resend) {
    console.log('📧 [DEV MODE] Password reset email:', { to, resetUrl });
    return;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Reset your password - urloft.site',
      html: `
        <h1>Reset your password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send email');
  }
}
