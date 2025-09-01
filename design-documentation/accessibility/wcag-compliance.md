# WCAG 2.1 Level AA Compliance Guide

**Version:** 1.0  
**Last Updated:** September 1, 2025  
**Compliance Level:** AA

---

## Overview

This document provides comprehensive guidelines for maintaining WCAG 2.1 Level AA compliance across the AIRI platform. All features must meet these standards to ensure accessibility for users with disabilities.

## WCAG 2.1 Principles

### 1. Perceivable
Information and user interface components must be presentable to users in ways they can perceive.

### 2. Operable
User interface components and navigation must be operable.

### 3. Understandable
Information and the operation of user interface must be understandable.

### 4. Robust
Content must be robust enough that it can be interpreted reliably by a wide variety of user agents, including assistive technologies.

## Compliance Checklist

### Level A Requirements (Must Have)

#### 1.1 Text Alternatives
- [ ] All non-text content has text alternatives
- [ ] Images have appropriate alt text
- [ ] Decorative images use empty alt="" or role="presentation"
- [ ] Complex images have long descriptions

#### 1.2 Time-based Media
- [ ] Captions provided for prerecorded audio
- [ ] Audio descriptions or text alternatives for video
- [ ] Sign language interpretation for key content (optional but recommended)

#### 1.3 Adaptable
- [ ] Content can be presented without losing meaning
- [ ] Proper semantic HTML structure
- [ ] Reading order is logical
- [ ] Instructions don't rely solely on sensory characteristics

#### 1.4 Distinguishable
- [ ] Color is not the only means of conveying information
- [ ] Audio control available for auto-playing sound
- [ ] Sufficient contrast ratios maintained

#### 2.1 Keyboard Accessible
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Keyboard shortcuts documented

#### 2.2 Enough Time
- [ ] Time limits can be adjusted
- [ ] Moving content can be paused
- [ ] Session timeouts provide warnings

#### 2.3 Seizures
- [ ] No content flashes more than 3 times per second
- [ ] Warnings provided for potentially seizure-inducing content

#### 2.4 Navigable
- [ ] Skip links provided
- [ ] Page titles are descriptive
- [ ] Focus order is logical
- [ ] Link purpose is clear

#### 3.1 Readable
- [ ] Language of page is identified
- [ ] Language changes are marked

#### 3.2 Predictable
- [ ] Navigation is consistent
- [ ] Components behave predictably
- [ ] No unexpected context changes

#### 3.3 Input Assistance
- [ ] Errors are clearly identified
- [ ] Labels and instructions provided
- [ ] Error prevention for legal/financial data

#### 4.1 Compatible
- [ ] Valid HTML/CSS
- [ ] Name, role, value available for all UI components
- [ ] Status messages announced to screen readers

### Level AA Requirements (Additional)

#### 1.2 Time-based Media
- [ ] Captions for live audio
- [ ] Audio description for prerecorded video

#### 1.3 Adaptable
- [ ] Orientation not restricted
- [ ] Input purpose can be determined

#### 1.4 Distinguishable
- [ ] Contrast ratio 4.5:1 for normal text
- [ ] Contrast ratio 3:1 for large text
- [ ] Text can be resized to 200% without horizontal scrolling
- [ ] Images of text avoided (except logos)
- [ ] Content reflows at 320px width
- [ ] Non-text contrast 3:1 for UI components
- [ ] Text spacing adjustable
- [ ] Content on hover/focus is dismissible

#### 2.4 Navigable
- [ ] Multiple ways to find pages
- [ ] Headings and labels are descriptive
- [ ] Focus indicators visible

#### 3.1 Readable
- [ ] Unusual words explained
- [ ] Abbreviations expanded
- [ ] Reading level appropriate

#### 3.2 Predictable
- [ ] Consistent navigation
- [ ] Consistent identification

#### 3.3 Input Assistance
- [ ] Error suggestions provided
- [ ] Context-sensitive help available

## Implementation Guidelines

### Color Contrast Testing

```css
/* Contrast Ratios - Use tools to verify */

/* Normal Text (4.5:1 minimum) */
.text-primary {
  color: #27272A; /* neutral-800 */
  background: #FFFFFF; /* Ratio: 12.63:1 ✅ */
}

/* Large Text (3:1 minimum) */
.text-large {
  color: #52525B; /* neutral-600 */
  background: #FFFFFF; /* Ratio: 7.04:1 ✅ */
  font-size: 18px;
}

/* UI Components (3:1 minimum) */
.button {
  background: #6366F1; /* primary-500 */
  color: #FFFFFF; /* Ratio: 4.52:1 ✅ */
}

/* Focus Indicators (3:1 minimum) */
:focus {
  outline: 2px solid #6366F1; /* Against white: 4.52:1 ✅ */
}
```

### Keyboard Navigation Implementation

```typescript
// Keyboard navigation handler
const handleKeyDown = (event: KeyboardEvent) => {
  switch(event.key) {
    case 'Tab':
      // Normal tab behavior
      break;
    case 'Escape':
      // Close modals/dropdowns
      closeModal();
      break;
    case 'Enter':
    case ' ':
      // Activate buttons
      if (event.target.role === 'button') {
        event.preventDefault();
        activateButton(event.target);
      }
      break;
    case 'ArrowDown':
    case 'ArrowUp':
      // Navigate menus
      if (isMenu(event.target)) {
        event.preventDefault();
        navigateMenu(event.key);
      }
      break;
  }
};
```

### ARIA Implementation

```html
<!-- Proper ARIA usage -->

<!-- Landmarks -->
<header role="banner">...</header>
<nav role="navigation" aria-label="Main">...</nav>
<main role="main">...</main>
<footer role="contentinfo">...</footer>

<!-- Live Regions -->
<div role="status" aria-live="polite" aria-atomic="true">
  <!-- Status updates -->
</div>

<div role="alert" aria-live="assertive">
  <!-- Important alerts -->
</div>

<!-- Form Controls -->
<input
  type="email"
  id="email"
  aria-label="Email address"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="email-error email-hint"
/>

<!-- Buttons -->
<button
  aria-label="Close dialog"
  aria-pressed="false"
  aria-expanded="false"
  aria-controls="dialog-content"
>
  <svg aria-hidden="true">...</svg>
</button>

<!-- Modals -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Dialog Title</h2>
  <p id="dialog-description">Dialog description...</p>
</div>
```

### Screen Reader Testing Scripts

#### NVDA Testing (Windows)
1. **Start NVDA**: Ctrl + Alt + N
2. **Browse Mode**: Use arrow keys to navigate
3. **Focus Mode**: Tab through interactive elements
4. **Headings**: H key to jump between headings
5. **Landmarks**: D key for landmarks
6. **Forms**: F key for form fields
7. **Tables**: T key for tables

#### VoiceOver Testing (macOS/iOS)
1. **Start VoiceOver**: Cmd + F5
2. **Navigate**: VO + Arrow keys
3. **Rotor**: VO + U
4. **Interact**: VO + Shift + Down Arrow
5. **Stop Interact**: VO + Shift + Up Arrow

#### JAWS Testing (Windows)
1. **Virtual Cursor**: Arrow keys
2. **Headings**: H key
3. **Forms Mode**: Enter on form field
4. **Links List**: Insert + F7
5. **Headings List**: Insert + F6

### Automated Testing Tools

```javascript
// axe-core integration
import { axe } from '@axe-core/react';

// Run in development
if (process.env.NODE_ENV === 'development') {
  axe(React, ReactDOM, 1000, {
    rules: {
      'color-contrast': { enabled: true },
      'valid-lang': { enabled: true },
      'duplicate-id': { enabled: true }
    }
  });
}

// Jest testing
describe('Accessibility Tests', () => {
  test('Page has no accessibility violations', async () => {
    const { container } = render(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// Cypress testing
describe('Accessibility', () => {
  it('Has no detectable a11y violations', () => {
    cy.visit('/');
    cy.injectAxe();
    cy.checkA11y();
  });
});
```

### Manual Testing Checklist

#### Keyboard Testing
- [ ] Tab through all interactive elements
- [ ] Ensure logical tab order
- [ ] Check for keyboard traps
- [ ] Verify all functions work with keyboard
- [ ] Test escape key for closing modals
- [ ] Verify enter/space activate buttons

#### Screen Reader Testing
- [ ] All content is announced
- [ ] Form labels are associated
- [ ] Error messages are announced
- [ ] Dynamic content updates announced
- [ ] Images have appropriate alt text
- [ ] Headings create logical structure

#### Visual Testing
- [ ] Zoom to 200% - no horizontal scroll
- [ ] Check color contrast ratios
- [ ] Disable CSS - content still readable
- [ ] Check focus indicators visibility
- [ ] Test with Windows High Contrast
- [ ] Verify text spacing adjustable

#### Cognitive Testing
- [ ] Instructions are clear
- [ ] Errors are understandable
- [ ] No time pressure (or adjustable)
- [ ] Consistent navigation
- [ ] Help is available

## Common Issues and Solutions

### Issue: Low Color Contrast
**Solution:**
```css
/* Before (Fails) */
.text {
  color: #9CA3AF; /* gray-400 */
  background: white; /* 2.89:1 ratio ❌ */
}

/* After (Passes) */
.text {
  color: #6B7280; /* gray-500 */
  background: white; /* 4.65:1 ratio ✅ */
}
```

### Issue: Missing Form Labels
**Solution:**
```html
<!-- Before (Fails) -->
<input type="email" placeholder="Email">

<!-- After (Passes) -->
<label for="email">Email Address</label>
<input id="email" type="email" placeholder="name@example.com">

<!-- Or with aria-label -->
<input type="email" aria-label="Email Address" placeholder="name@example.com">
```

### Issue: Focus Not Visible
**Solution:**
```css
/* Custom focus styles */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #6366F1;
  border-radius: inherit;
}

/* Never remove focus indicators */
/* Bad */
:focus { outline: none; }

/* Good - Replace with visible alternative */
:focus { 
  outline: none;
  border: 2px solid #6366F1;
}
```

### Issue: Images Without Alt Text
**Solution:**
```html
<!-- Decorative images -->
<img src="decoration.jpg" alt="" role="presentation">

<!-- Informative images -->
<img src="chart.jpg" alt="Sales increased 25% from Q1 to Q2">

<!-- Complex images -->
<img src="diagram.jpg" alt="System architecture" longdesc="#architecture-description">
<div id="architecture-description">
  <!-- Detailed description -->
</div>
```

## Tools and Resources

### Testing Tools
- **axe DevTools**: Browser extension for accessibility testing
- **WAVE**: Web Accessibility Evaluation Tool
- **Lighthouse**: Built into Chrome DevTools
- **Pa11y**: Command line accessibility testing
- **Contrast Ratio Checkers**: WebAIM, Stark, Able

### Screen Readers
- **NVDA**: Free, Windows
- **JAWS**: Commercial, Windows
- **VoiceOver**: Built-in, macOS/iOS
- **TalkBack**: Built-in, Android
- **Narrator**: Built-in, Windows

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Compliance Monitoring

### Regular Audits
- Weekly: Automated testing on new features
- Monthly: Manual keyboard and screen reader testing
- Quarterly: Full accessibility audit
- Annually: Third-party accessibility review

### Metrics to Track
- Number of accessibility issues found
- Time to fix accessibility issues
- User complaints related to accessibility
- Automated test coverage percentage
- Screen reader user satisfaction scores

### Continuous Improvement
1. Include accessibility in definition of done
2. Train developers on accessibility
3. Test with real users with disabilities
4. Monitor and fix issues promptly
5. Stay updated with WCAG guidelines

---

*This WCAG compliance guide ensures the AIRI platform meets accessibility standards and provides equal access to all users.*