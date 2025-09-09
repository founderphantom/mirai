# Authentication Screen States

**Version:** 1.0  
**Last Updated:** September 1, 2025

---

## Overview

This document provides detailed specifications for every visual state of the authentication screens, including all interactive states, error conditions, and responsive variations.

## Screen Inventory

1. **Login Screen** - Primary authentication interface
2. **Signup Screen** - New user registration
3. **Password Reset Screen** - Account recovery
4. **OAuth Callback Screen** - OAuth processing
5. **Success Screen** - Post-authentication confirmation

## 1. Login Screen States

### 1.1 Initial State (Default)

```
Layout: Split-screen (desktop) / Single column (mobile)

Left Panel (Desktop only):
┌─────────────────────────────────────┐
│  Gradient Background                 │
│  (primary-600 → secondary-600)       │
│                                      │
│       [AIRI Logo]                   │
│                                      │
│   "Your AI Companion Awaits"        │
│                                      │
│   ✓ Chat with personality           │
│   ✓ Play games together             │
│   ✓ Voice conversations             │
│   ✓ Custom avatars                  │
│                                      │
│   [Testimonial Card]                │
│   "AIRI changed how I interact      │
│    with AI..." - User               │
│                                      │
└─────────────────────────────────────┘

Right Panel / Main Content:
┌─────────────────────────────────────┐
│                                      │
│     Welcome back                    │
│     Sign in to continue to AIRI     │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ 🔹 Continue with Google      │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ 🔹 Continue with Discord     │   │
│  └─────────────────────────────┘   │
│                                      │
│  ──────── or ────────               │
│                                      │
│  Email address                      │
│  ┌─────────────────────────────┐   │
│  │ you@example.com              │   │
│  └─────────────────────────────┘   │
│                                      │
│  Password                           │
│  ┌─────────────────────────────┐   │
│  │ ••••••••                     │   │
│  └─────────────────────────────┘   │
│                                      │
│  □ Remember me    Forgot password?  │
│                                      │
│  ┌─────────────────────────────┐   │
│  │       Sign In                │   │
│  └─────────────────────────────┘   │
│                                      │
│  Don't have an account? Sign up     │
│                                      │
└─────────────────────────────────────┘
```

**Visual Specifications:**
- Container max-width: 480px
- Padding: 32px (desktop), 24px (tablet), 16px (mobile)
- Card background: #FFFFFF
- Card shadow: 0 10px 40px -10px rgba(0,0,0,0.1)
- Border radius: 12px

### 1.2 Focus States

```
Email Input - Focused:
┌─────────────────────────────────────┐
│ you@example.com                  |  │ <- Cursor visible
└─────────────────────────────────────┘
Border: 2px solid primary-500
Shadow: 0 0 0 3px rgba(99,102,241,0.1)

Password Input - Focused with Show/Hide:
┌───────────────────────────────┬─────┐
│ ••••••••                      │ 👁  │
└───────────────────────────────┴─────┘
Border: 2px solid primary-500
Show/Hide icon: neutral-400 (hover: neutral-600)
```

### 1.3 Validation States

```
Email - Valid (Real-time):
┌───────────────────────────────┬─────┐
│ user@domain.com               │ ✓   │
└───────────────────────────────┴─────┘
Border: 1px solid success-500
Icon: success-500

Email - Invalid:
┌─────────────────────────────────────┐
│ invalid-email                       │
└─────────────────────────────────────┘
Border: 1px solid error-500
❌ Please enter a valid email address

Password - Too Weak:
┌─────────────────────────────────────┐
│ ••••                                │
└─────────────────────────────────────┘
Border: 1px solid error-500
❌ Password must be at least 8 characters
```

### 1.4 Loading States

```
Button - Loading:
┌─────────────────────────────────────┐
│       ⟳ Signing in...               │
└─────────────────────────────────────┘
Background: primary-400 (slightly lighter)
Spinner: Animated rotation
Text: "Signing in..."
Disabled: true

OAuth Button - Loading:
┌─────────────────────────────────────┐
│  ⟳ Connecting to Google...          │
└─────────────────────────────────────┘
```

### 1.5 Error States

```
General Error Banner:
┌─────────────────────────────────────┐
│ ⚠️ Invalid email or password.       │
│    Please try again or reset your   │
│    password.                        │
└─────────────────────────────────────┘
Background: error-50
Border: 1px solid error-200
Text: error-800

Rate Limit Error:
┌─────────────────────────────────────┐
│ 🔒 Too many attempts. Please try    │
│    again in 14:59.                  │
└─────────────────────────────────────┘
Background: warning-50
Border: 1px solid warning-200
Timer: Live countdown
```

### 1.6 Success State

```
Success Transition:
┌─────────────────────────────────────┐
│                                      │
│         ✓                           │
│     Welcome back, Sarah!            │
│     Redirecting to dashboard...      │
│                                      │
│     ████████░░░░░░░░                │
│                                      │
└─────────────────────────────────────┘
Animation: Checkmark scales in (spring easing)
Progress: Linear progress bar
Duration: 2 seconds before redirect
```

## 2. Signup Screen States

### 2.1 Initial State

```
┌─────────────────────────────────────┐
│                                      │
│     Create your account             │
│     Start your AI journey today     │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ 🔹 Sign up with Google       │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │ 🔹 Sign up with Discord      │   │
│  └─────────────────────────────┘   │
│                                      │
│  ──────── or ────────               │
│                                      │
│  Email address *                    │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  └─────────────────────────────┘   │
│                                      │
│  Password *                         │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  └─────────────────────────────┘   │
│  Password strength: ░░░░░           │
│                                      │
│  Confirm password *                 │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  └─────────────────────────────┘   │
│                                      │
│  □ I agree to the Terms of Service  │
│    and Privacy Policy               │
│                                      │
│  ┌─────────────────────────────┐   │
│  │     Create Account           │   │
│  └─────────────────────────────┘   │
│                                      │
│  Already have an account? Sign in   │
│                                      │
└─────────────────────────────────────┘
```

### 2.2 Password Strength Indicator

```
Weak (0-25%):
Password strength: ██░░░░░░░░
Color: error-500
Message: "Too weak - add more characters"

Fair (25-50%):
Password strength: ████░░░░░░
Color: warning-500
Message: "Fair - consider adding numbers"

Good (50-75%):
Password strength: ██████░░░░
Color: primary-500
Message: "Good password"

Strong (75-100%):
Password strength: ████████░░
Color: success-500
Message: "Strong password!"
```

### 2.3 Field Interaction Flow

```
Step 1 - Email Entry:
┌─────────────────────────────────────┐
│ sarah@example.com                ✓  │
└─────────────────────────────────────┘
✓ Email available

Step 2 - Password Creation:
┌─────────────────────────────────────┐
│ ••••••••••••                    👁  │
└─────────────────────────────────────┘
Password strength: ██████░░░░
✓ At least 8 characters
✓ Contains uppercase letter
✓ Contains number
○ Contains special character

Step 3 - Password Confirmation:
┌─────────────────────────────────────┐
│ ••••••••••••                    ✓  │
└─────────────────────────────────────┘
✓ Passwords match
```

## 3. Password Reset Screen States

### 3.1 Request Reset State

```
┌─────────────────────────────────────┐
│                                      │
│     Reset your password             │
│     We'll send you a reset link     │
│                                      │
│  Email address                      │
│  ┌─────────────────────────────┐   │
│  │ you@example.com              │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │    Send Reset Link           │   │
│  └─────────────────────────────┘   │
│                                      │
│  Back to sign in                    │
│                                      │
└─────────────────────────────────────┘
```

### 3.2 Email Sent State

```
┌─────────────────────────────────────┐
│                                      │
│         📧                          │
│     Check your email                │
│                                      │
│  We've sent a password reset link   │
│  to sarah@example.com               │
│                                      │
│  Didn't receive it?                 │
│  Check your spam folder or          │
│                                      │
│  ┌─────────────────────────────┐   │
│  │      Resend Email            │   │
│  └─────────────────────────────┘   │
│  Available in 59s                   │
│                                      │
│  Back to sign in                    │
│                                      │
└─────────────────────────────────────┘
```

### 3.3 New Password Entry State

```
┌─────────────────────────────────────┐
│                                      │
│     Create new password             │
│     Choose a strong password        │
│                                      │
│  New password *                     │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  └─────────────────────────────┘   │
│  Password strength: ░░░░░           │
│                                      │
│  Confirm new password *             │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │    Update Password            │   │
│  └─────────────────────────────┘   │
│                                      │
└─────────────────────────────────────┘
```

## 4. OAuth Callback Screen

### 4.1 Processing State

```
┌─────────────────────────────────────┐
│                                      │
│         ⟳                           │
│     Completing sign in...           │
│                                      │
│  Connecting to Google                │
│  ████████████░░░░░░░                │
│                                      │
│  Please wait while we set up        │
│  your account                       │
│                                      │
└─────────────────────────────────────┘
Animation: Spinner rotation
Progress: Determinate progress bar
Steps shown: 
1. Verifying credentials ✓
2. Creating account... (in progress)
3. Setting up dashboard (pending)
```

### 4.2 OAuth Error State

```
┌─────────────────────────────────────┐
│                                      │
│         ⚠️                          │
│     Authentication failed           │
│                                      │
│  We couldn't complete sign in       │
│  with Google.                       │
│                                      │
│  Error: Access denied               │
│                                      │
│  ┌─────────────────────────────┐   │
│  │      Try Again               │   │
│  └─────────────────────────────┘   │
│                                      │
│  ┌─────────────────────────────┐   │
│  │   Use Another Method         │   │
│  └─────────────────────────────┘   │
│                                      │
└─────────────────────────────────────┘
```

## 5. Mobile-Specific States

### 5.1 Mobile Login (320px - 767px)

```
┌─────────────────────┐
│  [AIRI Logo]        │
│                     │
│  Welcome back       │
│                     │
│ ┌─────────────────┐ │
│ │ 🔹 Google       │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ 🔹 Discord      │ │
│ └─────────────────┘ │
│                     │
│ ──── or ────       │
│                     │
│ Email               │
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ Password            │
│ ┌─────────────────┐ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ □ Remember me       │
│                     │
│ Forgot password?    │
│                     │
│ ┌─────────────────┐ │
│ │    Sign In      │ │
│ └─────────────────┘ │
│                     │
│ New? Sign up        │
│                     │
└─────────────────────┘
```

**Mobile Adaptations:**
- Full-width buttons
- Stacked layout
- Larger touch targets (min 44px)
- Simplified messaging
- Bottom-sheet keyboards

### 5.2 Mobile Keyboard Active

```
┌─────────────────────┐
│ Email               │ <- Scrolled to view
│ ┌─────────────────┐ │
│ │ user@           │ │
│ └─────────────────┘ │
├─────────────────────┤
│                     │
│   Q W E R T Y U I   │
│    A S D F G H J    │ <- Native keyboard
│     Z X C V B N     │
│    123  @  .  Done  │
│                     │
└─────────────────────┘
```

## 6. Responsive Breakpoints

### Desktop (1024px+)
- Split-screen layout
- 60/40 content split
- Side-by-side OAuth buttons
- Extended value propositions

### Tablet (768px - 1023px)
- Single column
- Centered card (max-width: 480px)
- Stacked OAuth buttons
- Condensed value props

### Mobile (320px - 767px)
- Full-width layout
- 16px padding
- Stacked everything
- Minimal value props
- Bottom-anchored CTAs

## 7. Dark Mode States (Future)

### Dark Theme Adaptations
```
Background: neutral-950
Card: neutral-900
Borders: neutral-800
Text Primary: neutral-50
Text Secondary: neutral-300
Shadows: rgba(0,0,0,0.5)
```

## 8. Micro-interactions

### Button Hover
```
Default → Hover:
- Background: 10% darker
- Shadow: Elevated (4px)
- Transform: translateY(-1px)
- Duration: 250ms ease-out
```

### Input Focus
```
Default → Focus:
- Border: primary-500
- Shadow: Ring effect
- Label: Float up (if floating labels)
- Duration: 150ms ease-out
```

### Form Submission
```
Submit → Processing → Success:
1. Button pressed (scale: 0.98)
2. Loading spinner appears
3. Success checkmark scales in
4. Redirect with fade
```

### Error Shake
```
On validation error:
- Horizontal shake: 10px
- Duration: 500ms
- Ease: Spring
- Red highlight pulse
```

## 9. Accessibility States

### High Contrast Mode
```
- Borders: 3px solid
- Focus rings: 4px
- Text: Pure black/white
- No shadows
- Increased font weights
```

### Focus Visible
```
:focus-visible {
  outline: 2px solid primary-500;
  outline-offset: 2px;
  border-radius: inherit;
}
```

### Screen Reader Announcements
```
- "Login form, 2 fields required"
- "Email, edit text, required"
- "Password hidden, edit text, required"
- "Sign in button"
- "Error: Invalid credentials"
- "Success: Redirecting to dashboard"
```

## 10. Performance States

### Skeleton Loading
```
┌─────────────────────────────────────┐
│ ████████████                        │
│ ████████████████████                │
│                                      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                      │
│ ████████                            │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                      │
│ ████████                            │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░        │
│                                      │
└─────────────────────────────────────┘
Animation: Shimmer effect
Duration: 1.5s infinite
```

### Progressive Enhancement
1. HTML form works without JS
2. JS adds validation
3. JS adds OAuth
4. JS adds animations
5. JS adds real-time feedback

---

*This screen states documentation provides pixel-perfect specifications for implementing all authentication screens and their various states.*