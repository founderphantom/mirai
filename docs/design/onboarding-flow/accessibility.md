# Accessibility Guidelines

## WCAG 2.1 AA Compliance

### Color Contrast Requirements

#### Text Contrast Ratios
- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18pt+ or 14pt+ bold): Minimum 3:1 contrast ratio
- **Interactive elements**: Minimum 3:1 contrast ratio against adjacent colors

#### Verified Color Combinations
```css
/* Primary combinations */
--text-on-primary: white; /* 8.5:1 with primary-500 ✓ */
--text-on-secondary: var(--neutral-900); /* 12.6:1 with neutral-100 ✓ */

/* Error states */
--text-on-error: white; /* 4.9:1 with error-500 ✓ */
--error-on-light: var(--error-600); /* 4.6:1 with white ✓ */

/* Success states */
--text-on-success: white; /* 5.2:1 with success-500 ✓ */
--success-on-light: var(--success-600); /* 4.5:1 with white ✓ */

/* Disabled states */
--disabled-text: var(--neutral-500); /* 4.5:1 with white ✓ */
--disabled-bg: var(--neutral-200);
```

### Keyboard Navigation

#### Tab Order
```html
<!-- Logical tab order example -->
<header>
  <nav>
    <a href="/" tabindex="0">Home</a>
    <a href="/dashboard" tabindex="0">Dashboard</a>
    <a href="/settings" tabindex="0">Settings</a>
  </nav>
</header>

<main>
  <form>
    <label for="email">Email</label>
    <input id="email" type="email" tabindex="0">
    
    <label for="password">Password</label>
    <input id="password" type="password" tabindex="0">
    
    <button type="submit" tabindex="0">Sign In</button>
  </form>
</main>

<footer>
  <!-- Skip negative tabindex for decorative elements -->
  <div class="decoration" tabindex="-1"></div>
</footer>
```

#### Keyboard Shortcuts
```javascript
const keyboardShortcuts = {
  // Global shortcuts
  'Ctrl+K': 'Open command palette',
  'Ctrl+/': 'Open keyboard shortcuts',
  'Escape': 'Close modal/dialog',
  
  // Navigation shortcuts
  'Alt+D': 'Go to dashboard',
  'Alt+S': 'Go to settings',
  'Alt+N': 'Start new chat',
  
  // Form shortcuts
  'Enter': 'Submit form (when in input)',
  'Tab': 'Next field',
  'Shift+Tab': 'Previous field',
  
  // Chat shortcuts
  'Ctrl+Enter': 'Send message',
  'Ctrl+L': 'Clear chat',
  'Up/Down': 'Navigate chat history'
}
```

### Screen Reader Support

#### ARIA Labels
```html
<!-- Sign Out Button -->
<button 
  aria-label="Sign out of your account"
  aria-describedby="signout-description"
  role="button"
>
  <svg aria-hidden="true"><!-- icon --></svg>
  <span>Sign Out</span>
</button>
<span id="signout-description" class="sr-only">
  This will end your session and return you to the login page
</span>

<!-- Start New Chat Button -->
<button
  aria-label="Start a new chat conversation"
  aria-describedby="newchat-description"
  role="button"
>
  <svg aria-hidden="true"><!-- icon --></svg>
  <span>Start New Chat</span>
</button>
<span id="newchat-description" class="sr-only">
  Create a new chat session to begin a conversation
</span>

<!-- Form Fields -->
<div class="form-field">
  <label for="user-email" id="email-label">
    Email Address
    <span aria-label="required">*</span>
  </label>
  <input
    id="user-email"
    type="email"
    aria-labelledby="email-label"
    aria-describedby="email-error"
    aria-required="true"
    aria-invalid="false"
  >
  <span id="email-error" role="alert" aria-live="polite"></span>
</div>
```

#### Live Regions
```html
<!-- Status announcements -->
<div 
  id="status-region" 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  class="sr-only"
>
  <!-- Dynamic content announced to screen readers -->
</div>

<!-- Error announcements -->
<div 
  id="error-region" 
  role="alert" 
  aria-live="assertive" 
  aria-atomic="true"
  class="sr-only"
>
  <!-- Critical error messages -->
</div>

<!-- Loading states -->
<div 
  role="status" 
  aria-live="polite"
  aria-busy="true"
  aria-label="Loading content"
>
  <span class="sr-only">Loading...</span>
  <!-- Visual loading indicator -->
</div>
```

### Focus Management

#### Focus Indicators
```css
/* Default focus styles */
:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

/* Custom focus for different elements */
button:focus-visible {
  outline: 3px solid var(--primary-500);
  outline-offset: 2px;
}

input:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
}

a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
  text-decoration: underline;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :focus-visible {
    outline-width: 3px;
    outline-style: solid;
  }
}
```

#### Focus Trap Implementation
```javascript
class FocusTrap {
  constructor(element) {
    this.element = element
    this.focusableElements = this.getFocusableElements()
    this.firstFocusable = this.focusableElements[0]
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1]
    this.activate()
  }
  
  getFocusableElements() {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')
    
    return Array.from(this.element.querySelectorAll(selector))
  }
  
  activate() {
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this))
    this.firstFocusable?.focus()
  }
  
  handleKeyDown(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === this.firstFocusable) {
          e.preventDefault()
          this.lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === this.lastFocusable) {
          e.preventDefault()
          this.firstFocusable?.focus()
        }
      }
    }
    
    if (e.key === 'Escape') {
      this.deactivate()
    }
  }
  
  deactivate() {
    this.element.removeEventListener('keydown', this.handleKeyDown)
  }
}
```

### Motion and Animation

#### Reduced Motion Support
```css
/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  /* Maintain essential feedback */
  button:focus-visible,
  input:focus-visible {
    transition-duration: 0ms !important;
  }
}

/* Progressive enhancement for motion */
@media (prefers-reduced-motion: no-preference) {
  .animate-on-scroll {
    animation: fadeInUp 0.6s ease-out;
  }
  
  .parallax-element {
    will-change: transform;
    transition: transform 0.3s ease-out;
  }
}
```

### Form Accessibility

#### Error Handling
```html
<!-- Accessible error messages -->
<form aria-label="Sign in form">
  <div class="form-field">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      aria-invalid="true"
      aria-describedby="email-error"
    >
    <span 
      id="email-error" 
      class="error-message"
      role="alert"
      aria-live="assertive"
    >
      Please enter a valid email address
    </span>
  </div>
</form>
```

#### Form Instructions
```html
<!-- Clear instructions for complex forms -->
<form>
  <fieldset>
    <legend>Account Information</legend>
    <p id="form-instructions" class="instructions">
      All fields marked with an asterisk (*) are required.
      Password must be at least 8 characters.
    </p>
    
    <div class="form-field">
      <label for="username">
        Username
        <span aria-label="required" class="required">*</span>
      </label>
      <input
        id="username"
        type="text"
        aria-required="true"
        aria-describedby="form-instructions username-help"
      >
      <span id="username-help" class="help-text">
        Choose a unique username
      </span>
    </div>
  </fieldset>
</form>
```

### Touch Target Guidelines

#### Minimum Sizes
```css
/* Touch targets must be at least 44x44 pixels */
button,
a,
input[type="checkbox"],
input[type="radio"] {
  min-width: 44px;
  min-height: 44px;
  /* Add padding if content is smaller */
  padding: max(12px, calc((44px - 1em) / 2));
}

/* Ensure adequate spacing between targets */
.button-group > * + * {
  margin-left: 8px; /* Minimum 8px between targets */
}

/* Mobile-specific adjustments */
@media (pointer: coarse) {
  button,
  a {
    min-height: 48px; /* Larger targets for touch */
    padding: 14px 20px;
  }
}
```

### Testing Checklist

#### Automated Testing
- [ ] Run axe-core accessibility checker
- [ ] Validate HTML with W3C validator
- [ ] Check color contrast with WebAIM tool
- [ ] Test with WAVE browser extension

#### Manual Testing
- [ ] Navigate entire app using only keyboard
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify focus indicators are visible
- [ ] Check forms work without JavaScript
- [ ] Test with browser zoom at 200%
- [ ] Verify no horizontal scrolling at 320px width
- [ ] Test with Windows High Contrast mode
- [ ] Validate all images have alt text
- [ ] Ensure videos have captions
- [ ] Check that errors are announced