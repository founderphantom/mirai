import { z } from 'zod'

// Email validation schema
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim()

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

// Login form validation schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

// Signup form validation schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// Password reset validation schema
export const resetPasswordSchema = z.object({
  email: emailSchema,
})

// New password validation schema
export const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type NewPasswordFormData = z.infer<typeof newPasswordSchema>

// Password strength calculator
export function calculatePasswordStrength(password: string): {
  score: number
  level: 'weak' | 'fair' | 'good' | 'strong'
  feedback: string[]
} {
  let score = 0
  const feedback: string[] = []
  
  // Length checks
  if (password.length >= 8) score += 20
  else feedback.push('Use at least 8 characters')
  
  if (password.length >= 12) score += 10
  else if (password.length >= 8) feedback.push('Use 12+ characters for extra security')
  
  // Character type checks
  if (/[a-z]/.test(password)) score += 15
  else feedback.push('Add lowercase letters')
  
  if (/[A-Z]/.test(password)) score += 15
  else feedback.push('Add uppercase letters')
  
  if (/[0-9]/.test(password)) score += 20
  else feedback.push('Add numbers')
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 20
  else feedback.push('Add special characters (!@#$%^&*)')
  
  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong'
  if (score < 40) level = 'weak'
  else if (score < 60) level = 'fair'
  else if (score < 80) level = 'good'
  else level = 'strong'
  
  return { score: Math.min(score, 100), level, feedback }
}

// Form validation helper
export function validateField<T>(
  value: T,
  schema: z.ZodSchema<T>
): { isValid: boolean; errors: string[] } {
  try {
    schema.parse(value)
    return { isValid: true, errors: [] }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => e.message)
      }
    }
    return { isValid: false, errors: ['Validation failed'] }
  }
}

// Email validation helper
export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email)
    return true
  } catch {
    return false
  }
}

// Password validation helper
export function isValidPassword(password: string): boolean {
  try {
    passwordSchema.parse(password)
    return true
  } catch {
    return false
  }
}