# Authentication Interactions & Animations

**Version:** 1.0  
**Last Updated:** September 1, 2025

---

## Overview

This document defines all interactive behaviors, animations, and micro-interactions for the authentication experience. Every interaction is designed to provide immediate feedback, guide user actions, and create a smooth, delightful experience.

## Interaction Principles

1. **Immediate Feedback**: Every action receives instant visual response
2. **Predictable Behavior**: Consistent patterns across all interactions
3. **Smooth Transitions**: 60fps animations with natural easing
4. **Accessible Alternatives**: Reduced motion options available
5. **Performance First**: GPU-accelerated transforms only

## Core Interactions

### 1. Button Interactions

#### 1.1 Primary Button (Sign In, Create Account)

```typescript
interface ButtonInteraction {
  default: {
    background: 'primary-500',
    transform: 'scale(1)',
    shadow: 'shadow-md'
  },
  hover: {
    background: 'primary-600',
    transform: 'scale(1.02)',
    shadow: 'shadow-lg',
    duration: '250ms',
    easing: 'ease-out'
  },
  active: {
    background: 'primary-700',
    transform: 'scale(0.98)',
    shadow: 'shadow-sm',
    duration: '100ms',
    easing: 'ease-out'
  },
  focus: {
    outline: '2px solid primary-500',
    outlineOffset: '2px',
    duration: '150ms'
  },
  disabled: {
    background: 'neutral-300',
    cursor: 'not-allowed',
    opacity: 0.5
  },
  loading: {
    cursor: 'wait',
    animation: 'pulse 2s infinite'
  }
}
```

**Implementation:**
```css
.button-primary {
  transition: all 250ms cubic-bezier(0, 0, 0.2, 1);
  transform-origin: center;
  will-change: transform;
}

.button-primary:hover {
  transform: scale(1.02) translateZ(0);
  backface-visibility: hidden;
}

.button-primary:active {
  transition-duration: 100ms;
  transform: scale(0.98);
}
```

#### 1.2 OAuth Button Interactions

```typescript
interface OAuthButtonBehavior {
  idle: {
    iconPosition: 'translateX(0)',
    textOpacity: 1
  },
  hover: {
    iconPosition: 'translateX(4px)',
    background: 'lighten(10%)',
    duration: '250ms'
  },
  loading: {
    icon: 'spinner',
    iconAnimation: 'rotate 1s linear infinite',
    text: 'Connecting...'
  },
  success: {
    icon: 'checkmark',
    iconAnimation: 'scaleIn 300ms spring',
    background: 'success-500'
  }
}
```

**Animation Sequence:**
1. User hovers → Icon slides right 4px
2. User clicks → Button depresses
3. Loading starts → Spinner replaces icon
4. Success → Checkmark scales in with spring
5. Redirect → Fade out entire form

### 2. Input Field Interactions

#### 2.1 Text Input Focus Behavior

```typescript
interface InputInteraction {
  states: {
    default: {
      borderColor: 'neutral-300',
      borderWidth: '1px',
      labelPosition: 'inside',
      labelSize: '16px'
    },
    focus: {
      borderColor: 'primary-500',
      borderWidth: '2px',
      shadow: '0 0 0 3px rgba(99,102,241,0.1)',
      labelPosition: 'above',
      labelSize: '12px',
      duration: '200ms'
    },
    filled: {
      labelPosition: 'above',
      labelSize: '12px',
      labelColor: 'neutral-600'
    },
    error: {
      borderColor: 'error-500',
      shake: '10px horizontal',
      duration: '500ms'
    }
  }
}
```

**Floating Label Animation:**
```css
.input-label {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left center;
}

.input:focus + .input-label,
.input:not(:placeholder-shown) + .input-label {
  transform: translateY(-20px) scale(0.75);
  color: var(--primary-500);
}
```

#### 2.2 Password Field Toggle

```typescript
interface PasswordToggle {
  hidden: {
    icon: 'eye-closed',
    inputType: 'password',
    ariaLabel: 'Show password'
  },
  visible: {
    icon: 'eye-open',
    inputType: 'text',
    ariaLabel: 'Hide password',
    animation: 'rotateY 300ms'
  }
}
```

**Toggle Animation:**
1. Icon rotates 180° on Y-axis
2. Input type switches at 50% point
3. Smooth transition maintains input value

### 3. Form Validation Interactions

#### 3.1 Real-time Validation

```typescript
interface ValidationFeedback {
  timing: {
    debounce: 500, // ms after typing stops
    immediate: ['email format', 'password match'],
    onBlur: ['email availability', 'password strength']
  },
  visual: {
    valid: {
      borderColor: 'success-500',
      icon: 'checkmark',
      iconAnimation: 'fadeIn 200ms'
    },
    invalid: {
      borderColor: 'error-500',
      icon: 'x-mark',
      message: 'slideDown 200ms'
    },
    validating: {
      icon: 'spinner',
      iconAnimation: 'rotate 1s linear infinite'
    }
  }
}
```

**Email Validation Sequence:**
```
User types → Debounce 500ms → Check format → Show feedback
                              ↓ If valid
                              Check availability → Show result
```

#### 3.2 Password Strength Animation

```typescript
interface PasswordStrength {
  levels: [
    { score: 0, color: 'neutral-300', width: '0%' },
    { score: 1, color: 'error-500', width: '25%' },
    { score: 2, color: 'warning-500', width: '50%' },
    { score: 3, color: 'primary-500', width: '75%' },
    { score: 4, color: 'success-500', width: '100%' }
  ],
  animation: {
    duration: '300ms',
    easing: 'ease-out',
    property: 'width, background-color'
  }
}
```

### 4. Page Transitions

#### 4.1 Login to Dashboard Transition

```typescript
interface SuccessTransition {
  sequence: [
    { element: 'form', animation: 'fadeOut', duration: 200 },
    { element: 'success-message', animation: 'fadeIn', duration: 300 },
    { element: 'checkmark', animation: 'scaleIn', duration: 400 },
    { element: 'progress-bar', animation: 'fillWidth', duration: 2000 },
    { element: 'page', animation: 'slideLeft', duration: 300 }
  ]
}
```

**Implementation:**
```css
@keyframes slideLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-20px);
    opacity: 0;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
```

#### 4.2 Error Recovery Animation

```typescript
interface ErrorAnimation {
  shake: {
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(10px)' },
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(10px)' },
      { transform: 'translateX(0)' }
    ],
    duration: '500ms',
    easing: 'ease-out'
  },
  highlight: {
    animation: 'pulse-red 1s 2',
    borderColor: 'error-500'
  }
}
```

### 5. OAuth Flow Interactions

#### 5.1 OAuth Popup Handling

```typescript
interface OAuthPopupBehavior {
  opening: {
    parentWindow: 'blur-background',
    loadingIndicator: 'show',
    pollingInterval: 500 // ms
  },
  success: {
    popup: 'close',
    parentWindow: 'remove-blur',
    animation: 'success-sequence'
  },
  failure: {
    popup: 'close',
    parentWindow: 'show-error',
    fallback: 'show-alternatives'
  }
}
```

**Popup Communication:**
```javascript
// Parent window
const popup = window.open(oauthUrl, 'oauth', 'width=500,height=600');
const timer = setInterval(() => {
  if (popup.closed) {
    clearInterval(timer);
    handleOAuthComplete();
  }
}, 500);

// Success handling
window.addEventListener('message', (event) => {
  if (event.data.type === 'oauth-success') {
    popup.close();
    animateSuccess();
  }
});
```

### 6. Loading States

#### 6.1 Skeleton Loading

```typescript
interface SkeletonAnimation {
  shimmer: {
    gradient: 'linear-gradient(90deg, 
      transparent 0%, 
      rgba(255,255,255,0.1) 50%, 
      transparent 100%)',
    animation: 'shimmer 1.5s infinite',
    backgroundSize: '200% 100%'
  }
}
```

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

#### 6.2 Progressive Loading

```typescript
interface ProgressiveLoad {
  sequence: [
    { show: 'logo', delay: 0 },
    { show: 'heading', delay: 100 },
    { show: 'oauth-buttons', delay: 200 },
    { show: 'form-fields', delay: 300 },
    { show: 'footer-links', delay: 400 }
  ],
  animation: 'fadeInUp 300ms ease-out'
}
```

### 7. Micro-interactions

#### 7.1 Checkbox Toggle

```typescript
interface CheckboxAnimation {
  unchecked: {
    background: 'transparent',
    border: '2px solid neutral-400'
  },
  checked: {
    background: 'primary-500',
    border: '2px solid primary-500',
    checkmark: {
      animation: 'draw-checkmark 300ms ease-out',
      strokeDasharray: 30,
      strokeDashoffset: [30, 0]
    }
  }
}
```

#### 7.2 Link Hover

```typescript
interface LinkHover {
  default: {
    textDecoration: 'none',
    color: 'primary-600'
  },
  hover: {
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    transition: 'all 150ms ease-out'
  }
}
```

### 8. Touch Interactions (Mobile)

#### 8.1 Touch Feedback

```typescript
interface TouchFeedback {
  tapHighlight: {
    color: 'rgba(99, 102, 241, 0.1)',
    duration: '300ms'
  },
  rippleEffect: {
    origin: 'touch-point',
    expansion: 'scale(2)',
    duration: '600ms',
    opacity: [0.3, 0]
  }
}
```

#### 8.2 Pull to Refresh (Future)

```typescript
interface PullToRefresh {
  threshold: 80, // pixels
  resistance: 2.5,
  indicators: {
    pulling: 'arrow-down',
    ready: 'arrow-up-bounce',
    refreshing: 'spinner',
    complete: 'checkmark'
  }
}
```

### 9. Keyboard Interactions

#### 9.1 Tab Navigation

```typescript
interface TabNavigation {
  order: [
    'skip-link',
    'google-oauth',
    'discord-oauth',
    'email-input',
    'password-input',
    'remember-checkbox',
    'forgot-link',
    'submit-button',
    'signup-link'
  ],
  visualIndicator: {
    outline: '2px solid primary-500',
    outlineOffset: '2px',
    borderRadius: 'inherit'
  }
}
```

#### 9.2 Keyboard Shortcuts

```typescript
interface KeyboardShortcuts {
  'Cmd/Ctrl + Enter': 'submit-form',
  'Escape': 'clear-errors',
  'Tab': 'next-field',
  'Shift + Tab': 'previous-field',
  'Space': 'toggle-checkbox'
}
```

### 10. Accessibility Interactions

#### 10.1 Screen Reader Announcements

```typescript
interface Announcements {
  formChanges: {
    errorAdded: 'Error: {message}',
    errorCleared: 'Error cleared',
    validationSuccess: '{field} is valid',
    loadingStart: 'Processing, please wait',
    loadingComplete: 'Complete'
  },
  liveRegions: {
    polite: ['field-hints', 'success-messages'],
    assertive: ['errors', 'warnings']
  }
}
```

#### 10.2 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 11. Performance Optimizations

#### 11.1 Animation Performance

```typescript
interface PerformanceRules {
  useGPU: ['transform', 'opacity', 'filter'],
  avoid: ['width', 'height', 'top', 'left'],
  willChange: 'auto', // Only when needed
  containment: 'layout style paint',
  passiveListeners: true
}
```

#### 11.2 Debouncing & Throttling

```typescript
interface OptimizationStrategies {
  debounce: {
    validation: 500, // ms
    search: 300,
    resize: 150
  },
  throttle: {
    scroll: 16, // ~60fps
    mousemove: 50,
    apiCalls: 1000
  }
}
```

## Animation Timing Functions

### Custom Easing Curves

```css
:root {
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

## Implementation Examples

### React Spring Configuration

```typescript
const buttonSpring = useSpring({
  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
  shadow: isHovered ? '0 10px 30px -10px rgba(0,0,0,0.2)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
  config: {
    tension: 300,
    friction: 20
  }
});
```

### Framer Motion Variants

```typescript
const formVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      staggerChildren: 0.1
    }
  },
  exit: { opacity: 0, x: -20 }
};
```

### CSS Animation Classes

```css
.animate-in {
  animation: fadeInUp 300ms ease-out forwards;
}

.animate-success {
  animation: scaleIn 400ms var(--ease-spring) forwards;
}

.animate-error {
  animation: shake 500ms ease-out;
}

.animate-loading {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

*This interactions documentation ensures consistent, performant, and delightful animations throughout the authentication experience.*