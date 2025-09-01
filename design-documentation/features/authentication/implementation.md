# Authentication Implementation Guide

**Version:** 1.0  
**Last Updated:** September 1, 2025  
**Stack:** Next.js 14, Supabase Auth, TailwindCSS, shadcn/ui

---

## Overview

This implementation guide provides developers with complete specifications, code examples, and technical requirements for building the AIRI authentication system. All code follows best practices for security, performance, and maintainability.

## Technical Architecture

### Component Structure

```
/app/
├── (auth)/
│   ├── layout.tsx              # Auth layout wrapper
│   ├── login/
│   │   └── page.tsx           # Login page
│   ├── signup/
│   │   └── page.tsx           # Signup page
│   ├── reset/
│   │   └── page.tsx           # Password reset
│   └── callback/
│       └── page.tsx           # OAuth callback handler
│
/components/auth/
├── AuthLayout.tsx             # Split-screen layout
├── LoginForm.tsx              # Login form component
├── SignupForm.tsx             # Signup form component  
├── OAuthButtons.tsx           # Social login buttons
├── PasswordStrength.tsx       # Password strength meter
├── AuthCard.tsx              # Card container
└── AuthInput.tsx             # Custom input component
│
/lib/
├── auth/
│   ├── supabase.ts           # Supabase client
│   ├── validation.ts         # Zod schemas
│   └── hooks.ts              # Auth hooks
└── utils/
    └── cn.ts                 # Class name utility
```

## Core Components

### 1. Auth Layout Component

```tsx
// app/(auth)/layout.tsx
import { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Sign In - AIRI',
  description: 'Sign in to your AIRI account to access your AI companion',
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-gradient-to-br from-primary-600 to-secondary-600 p-12 flex-col justify-between">
        <div>
          <Image
            src="/logo-white.svg"
            alt="AIRI"
            width={120}
            height={40}
            className="mb-12"
          />
          <h1 className="text-4xl font-bold text-white mb-4">
            Your AI Companion Awaits
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Experience the future of AI interaction with personalized companions, 
            voice chat, and gaming integration.
          </p>
          
          <div className="space-y-4">
            <Feature icon="💬" text="Natural conversations with personality" />
            <Feature icon="🎮" text="Play Minecraft together" />
            <Feature icon="🎙️" text="Voice interactions with emotion" />
            <Feature icon="👤" text="Customizable avatars" />
          </div>
        </div>
        
        <Testimonial />
      </div>
      
      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center space-x-3">
      <span className="text-2xl">{icon}</span>
      <span className="text-white/90">{text}</span>
    </div>
  );
}

function Testimonial() {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
      <p className="text-white/90 italic mb-4">
        "AIRI transformed how I interact with AI. It feels like having a real companion 
        who understands me and can even join me in games!"
      </p>
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/20 rounded-full" />
        <div>
          <p className="text-white font-medium">Sarah Chen</p>
          <p className="text-white/70 text-sm">Early Adopter</p>
        </div>
      </div>
    </div>
  );
}
```

### 2. Login Form Component

```tsx
// components/auth/LoginForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { supabase } from '@/lib/auth/supabase';
import { OAuthButtons } from './OAuthButtons';
import { AuthInput } from './AuthInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });
  
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.');
        } else {
          setError(error.message);
        }
        return;
      }
      
      // Success - redirect to dashboard
      router.push('/dashboard');
      
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Welcome back
        </h1>
        <p className="text-neutral-600">
          Sign in to continue to AIRI
        </p>
      </div>
      
      {/* OAuth Buttons */}
      <OAuthButtons />
      
      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-neutral-500">or</span>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthInput
          label="Email address"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
          {...register('email')}
        />
        
        <AuthInput
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          autoComplete="current-password"
          showPasswordToggle
          {...register('password')}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember"
              {...register('rememberMe')}
            />
            <label 
              htmlFor="remember" 
              className="text-sm text-neutral-600 cursor-pointer"
            >
              Remember me
            </label>
          </div>
          
          <Link
            href="/auth/reset"
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        
        <Button
          type="submit"
          disabled={isLoading || !isValid}
          className="w-full h-12 text-base font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>
      
      <p className="mt-6 text-center text-sm text-neutral-600">
        Don't have an account?{' '}
        <Link
          href="/auth/signup"
          className="text-primary-600 hover:text-primary-700 font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

### 3. OAuth Buttons Component

```tsx
// components/auth/OAuthButtons.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/auth/supabase';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Provider = 'google' | 'discord';

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  
  const handleOAuthLogin = async (provider: Provider) => {
    setLoadingProvider(provider);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        console.error(`OAuth error with ${provider}:`, error);
        // Handle error - show toast notification
      }
    } catch (err) {
      console.error('Unexpected OAuth error:', err);
    } finally {
      // Don't reset loading state as page will redirect
    }
  };
  
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full h-12 relative"
        onClick={() => handleOAuthLogin('google')}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === 'google' ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-5 w-5" />
        )}
        Continue with Google
      </Button>
      
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full h-12"
        onClick={() => handleOAuthLogin('discord')}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === 'discord' ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <DiscordIcon className="mr-2 h-5 w-5" />
        )}
        Continue with Discord
      </Button>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}
```

### 4. Custom Input Component

```tsx
// components/auth/AuthInput.tsx
'use client';

import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
  showValidation?: boolean;
  isValid?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ 
    label, 
    error, 
    showPasswordToggle, 
    showValidation,
    isValid,
    className, 
    type = 'text',
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const inputType = showPassword ? 'text' : type;
    
    return (
      <div className="space-y-1">
        <label 
          htmlFor={props.id || props.name}
          className="block text-sm font-medium text-neutral-700"
        >
          {label}
          {props.required && (
            <span className="text-error-500 ml-1" aria-label="required">*</span>
          )}
        </label>
        
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'w-full px-3 py-2 border rounded-lg',
              'text-neutral-900 placeholder-neutral-400',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              {
                'border-neutral-300': !error && !isFocused,
                'border-primary-500': isFocused && !error,
                'border-error-500': error,
                'pr-10': showPasswordToggle || showValidation,
              },
              className
            )}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          
          {/* Password Toggle */}
          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
          
          {/* Validation Icon */}
          {showValidation && !showPasswordToggle && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValid ? (
                <Check className="h-4 w-4 text-success-500" />
              ) : (
                <X className="h-4 w-4 text-error-500" />
              )}
            </div>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <p 
            id={`${props.id}-error`}
            className="text-sm text-error-600 mt-1"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';
```

### 5. Validation Schemas

```typescript
// lib/auth/validation.ts
import { z } from 'zod';

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

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
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Password strength calculator
export function calculatePasswordStrength(password: string): number {
  let strength = 0;
  
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  return Math.min(Math.floor((strength / 6) * 100), 100);
}
```

### 6. Supabase Configuration

```typescript
// lib/auth/supabase.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';

export const supabase = createClientComponentClient<Database>();

// Auth helper functions
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signInWithOAuth(provider: 'google' | 'discord') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset/confirm`,
  });
  
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) throw error;
  return data;
}
```

### 7. Auth Hooks

```typescript
// lib/auth/hooks.ts
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };
  
  return {
    user,
    session,
    loading,
    signOut,
  };
}

export function useRequireAuth(redirectTo = '/auth/login') {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);
  
  return { user, loading };
}
```

### 8. Middleware for Route Protection

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  // Protected routes
  const protectedPaths = ['/dashboard', '/chat', '/settings', '/gaming'];
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  );
  
  // Auth routes (redirect if already authenticated)
  const authPaths = ['/auth/login', '/auth/signup'];
  const isAuthPath = authPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  );
  
  // Redirect logic
  if (isProtectedPath && !session) {
    const redirectUrl = new URL('/auth/login', req.url);
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  
  return res;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/chat/:path*',
    '/settings/:path*',
    '/gaming/:path*',
    '/auth/:path*',
  ],
};
```

## Styling with TailwindCSS

### TailwindCSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          // ... (all primary shades)
          600: '#4F46E5',
          // ...
        },
        secondary: {
          // ... (all secondary shades)
        },
        // ... (other color scales)
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 400ms ease-out',
        'pulse-border': 'pulseBorder 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseBorder: {
          '0%, 100%': { borderColor: 'rgb(99 102 241 / 0.5)' },
          '50%': { borderColor: 'rgb(99 102 241 / 1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Testing Implementation

```typescript
// __tests__/auth/login.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('validates email format', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });
  
  it('shows password toggle functionality', () => {
    render(<LoginForm />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByLabelText(/show password/i);
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
```

## Performance Optimizations

```typescript
// Lazy load OAuth SDKs
const loadGoogleSDK = () => import('@/lib/oauth/google');
const loadDiscordSDK = () => import('@/lib/oauth/discord');

// Debounce validation
import { debounce } from 'lodash';

const validateEmail = debounce(async (email: string) => {
  // Validation logic
}, 500);

// Optimistic UI updates
const handleSubmit = async (data: FormData) => {
  // Show success immediately
  setUIState('success');
  
  try {
    await submitForm(data);
  } catch (error) {
    // Revert on error
    setUIState('error');
  }
};
```

---

*This implementation guide provides everything needed to build a production-ready authentication system for the AIRI platform.*