import { registerUser, verifyEmail, loginUser, forgotPassword, resetPassword } from './auth.service';

export const authController = {
  async register(body: { username: string; email: string; password: string }) {
    try {
      const result = await registerUser(body);
      return {
        status: 201,
        body: {
          message: 'Registration successful. Please check your email to verify your account.',
          userId: result.userId,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorCode = error.message;
        if (errorCode === 'email_already_exists' || errorCode === 'username_already_exists') {
          return {
            status: 409,
            body: {
              error: errorCode,
              message: errorCode === 'email_already_exists' ? 'Email already registered' : 'Username already taken',
            },
          };
        }
        if (errorCode.includes('Invalid') || errorCode.includes('must be')) {
          return {
            status: 422,
            body: {
              error: 'validation_error',
              message: error.message,
            },
          };
        }
      }
      throw error;
    }
  },

  async verifyEmail(token: string) {
    try {
      await verifyEmail(token);
      return {
        status: 200,
        body: {
          message: 'Email verified successfully. You can now login.',
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorCode = error.message;
        if (errorCode === 'token_invalid') {
          return {
            status: 404,
            body: {
              error: errorCode,
              message: 'Invalid verification token',
            },
          };
        }
        if (errorCode === 'token_expired') {
          return {
            status: 410,
            body: {
              error: errorCode,
              message: 'Verification token has expired',
            },
          };
        }
      }
      throw error;
    }
  },

  async login(body: { email: string; password: string }) {
    try {
      const result = await loginUser(body);
      return {
        status: 200,
        body: {
          access_token: result.token,
          user: result.user,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorCode = error.message;
        if (errorCode === 'invalid_credentials') {
          return {
            status: 401,
            body: {
              error: errorCode,
              message: 'Invalid email or password',
            },
          };
        }
        if (errorCode === 'email_not_verified') {
          return {
            status: 403,
            body: {
              error: errorCode,
              message: 'Please verify your email before logging in',
            },
          };
        }
      }
      throw error;
    }
  },

  async forgotPassword(body: { email: string }) {
    try {
      await forgotPassword(body.email);
      return {
        status: 200,
        body: {
          message: 'If an account exists with this email, a password reset link has been sent',
        },
      };
    } catch (error) {
      throw error;
    }
  },

  async resetPassword(body: { token: string; newPassword: string }) {
    try {
      await resetPassword(body.token, body.newPassword);
      return {
        status: 200,
        body: {
          message: 'Password reset successfully. You can now login with your new password',
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorCode = error.message;
        if (errorCode === 'token_invalid') {
          return {
            status: 404,
            body: {
              error: errorCode,
              message: 'Invalid reset token',
            },
          };
        }
        if (errorCode === 'token_expired') {
          return {
            status: 410,
            body: {
              error: errorCode,
              message: 'Reset token has expired',
            },
          };
        }
        if (errorCode.includes('Password must be')) {
          return {
            status: 422,
            body: {
              error: 'validation_error',
              message: error.message,
            },
          };
        }
      }
      throw error;
    }
  },
};
