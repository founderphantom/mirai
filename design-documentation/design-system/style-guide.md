# AIRI Design System - Style Guide

**Version:** 1.0  
**Last Updated:** September 1, 2025  
**Status:** Active

---

## Color Palette

### Brand Colors

#### Primary - Indigo
```css
--color-primary-50: #EEF2FF;
--color-primary-100: #E0E7FF;
--color-primary-200: #C7D2FE;
--color-primary-300: #A5B4FC;
--color-primary-400: #818CF8;
--color-primary-500: #6366F1; /* Main Primary */
--color-primary-600: #4F46E5;
--color-primary-700: #4338CA;
--color-primary-800: #3730A3;
--color-primary-900: #312E81;
--color-primary-950: #1E1B4B;
```

#### Secondary - Violet
```css
--color-secondary-50: #FAF5FF;
--color-secondary-100: #F3E8FF;
--color-secondary-200: #E9D5FF;
--color-secondary-300: #D8B4FE;
--color-secondary-400: #C084FC;
--color-secondary-500: #8B5CF6; /* Main Secondary */
--color-secondary-600: #7C3AED;
--color-secondary-700: #6D28D9;
--color-secondary-800: #5B21B6;
--color-secondary-900: #4C1D95;
--color-secondary-950: #2E1065;
```

#### Accent - Pink
```css
--color-accent-50: #FDF2F8;
--color-accent-100: #FCE7F3;
--color-accent-200: #FBCFE8;
--color-accent-300: #F9A8D4;
--color-accent-400: #F472B6;
--color-accent-500: #EC4899; /* Main Accent */
--color-accent-600: #DB2777;
--color-accent-700: #BE185D;
--color-accent-800: #9D174D;
--color-accent-900: #831843;
--color-accent-950: #500724;
```

### Semantic Colors

#### Success - Emerald
```css
--color-success-50: #ECFDF5;
--color-success-100: #D1FAE5;
--color-success-200: #A7F3D0;
--color-success-300: #6EE7B7;
--color-success-400: #34D399;
--color-success-500: #10B981; /* Main Success */
--color-success-600: #059669;
--color-success-700: #047857;
--color-success-800: #065F46;
--color-success-900: #064E3B;
```

#### Warning - Amber
```css
--color-warning-50: #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-200: #FDE68A;
--color-warning-300: #FCD34D;
--color-warning-400: #FBBF24;
--color-warning-500: #F59E0B; /* Main Warning */
--color-warning-600: #D97706;
--color-warning-700: #B45309;
--color-warning-800: #92400E;
--color-warning-900: #78350F;
```

#### Error - Red
```css
--color-error-50: #FEF2F2;
--color-error-100: #FEE2E2;
--color-error-200: #FECACA;
--color-error-300: #FCA5A5;
--color-error-400: #F87171;
--color-error-500: #EF4444; /* Main Error */
--color-error-600: #DC2626;
--color-error-700: #B91C1C;
--color-error-800: #991B1B;
--color-error-900: #7F1D1D;
```

### Neutral Colors - Gray
```css
--color-neutral-50: #FAFAFA;
--color-neutral-100: #F4F4F5;
--color-neutral-200: #E4E4E7;
--color-neutral-300: #D4D4D8;
--color-neutral-400: #A1A1AA;
--color-neutral-500: #71717A;
--color-neutral-600: #52525B;
--color-neutral-700: #3F3F46;
--color-neutral-800: #27272A;
--color-neutral-900: #18181B;
--color-neutral-950: #09090B;
```

### Background Colors
```css
--color-background: #FFFFFF;
--color-background-secondary: #FAFAFA;
--color-background-tertiary: #F4F4F5;
--color-background-inverse: #09090B;

/* Dark mode */
--color-background-dark: #09090B;
--color-background-secondary-dark: #18181B;
--color-background-tertiary-dark: #27272A;
--color-background-inverse-dark: #FFFFFF;
```

## Typography

### Font Families
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
```

### Font Sizes (1.25 ratio - Major Third)
```css
--text-xs: 0.64rem;    /* 10.24px */
--text-sm: 0.8rem;     /* 12.8px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.25rem;    /* 20px */
--text-xl: 1.563rem;   /* 25px */
--text-2xl: 1.953rem;  /* 31.25px */
--text-3xl: 2.441rem;  /* 39.06px */
--text-4xl: 3.052rem;  /* 48.83px */
--text-5xl: 3.815rem;  /* 61.04px */
```

### Font Weights
```css
--font-thin: 100;
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
--font-black: 900;
```

### Line Heights
```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

### Letter Spacing
```css
--tracking-tighter: -0.05em;
--tracking-tight: -0.025em;
--tracking-normal: 0;
--tracking-wide: 0.025em;
--tracking-wider: 0.05em;
--tracking-widest: 0.1em;
```

## Spacing System

### Base Unit: 8px
```css
--space-0: 0;
--space-px: 1px;
--space-0.5: 0.125rem;  /* 2px */
--space-1: 0.25rem;     /* 4px */
--space-1.5: 0.375rem;  /* 6px */
--space-2: 0.5rem;      /* 8px */
--space-2.5: 0.625rem;  /* 10px */
--space-3: 0.75rem;     /* 12px */
--space-3.5: 0.875rem;  /* 14px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-7: 1.75rem;     /* 28px */
--space-8: 2rem;        /* 32px */
--space-9: 2.25rem;     /* 36px */
--space-10: 2.5rem;     /* 40px */
--space-11: 2.75rem;    /* 44px */
--space-12: 3rem;       /* 48px */
--space-14: 3.5rem;     /* 56px */
--space-16: 4rem;       /* 64px */
--space-20: 5rem;       /* 80px */
--space-24: 6rem;       /* 96px */
--space-28: 7rem;       /* 112px */
--space-32: 8rem;       /* 128px */
--space-36: 9rem;       /* 144px */
--space-40: 10rem;      /* 160px */
```

## Border Radius
```css
--radius-none: 0;
--radius-sm: 0.125rem;   /* 2px */
--radius-default: 0.25rem; /* 4px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-3xl: 1.5rem;    /* 24px */
--radius-full: 9999px;
```

## Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-default: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
--shadow-none: 0 0 #0000;

/* Colored shadows for hover states */
--shadow-primary: 0 10px 40px -10px rgba(99, 102, 241, 0.35);
--shadow-secondary: 0 10px 40px -10px rgba(139, 92, 246, 0.35);
--shadow-accent: 0 10px 40px -10px rgba(236, 72, 153, 0.35);
```

## Animation

### Timing Functions
```css
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Duration Scale
```css
--duration-instant: 0ms;
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
--duration-slower: 500ms;
--duration-slowest: 1000ms;
```

### Common Transitions
```css
--transition-all: all var(--duration-normal) var(--ease-out);
--transition-colors: background-color, border-color, color, fill, stroke var(--duration-normal) var(--ease-out);
--transition-opacity: opacity var(--duration-normal) var(--ease-out);
--transition-shadow: box-shadow var(--duration-normal) var(--ease-out);
--transition-transform: transform var(--duration-normal) var(--ease-out);
```

## Z-Index Scale
```css
--z-0: 0;
--z-10: 10;
--z-20: 20;
--z-30: 30;
--z-40: 40;
--z-50: 50;
--z-dropdown: 100;
--z-sticky: 200;
--z-overlay: 300;
--z-modal: 400;
--z-popover: 500;
--z-tooltip: 600;
--z-notification: 700;
--z-max: 9999;
```

## Breakpoints
```css
--screen-xs: 475px;
--screen-sm: 640px;
--screen-md: 768px;
--screen-lg: 1024px;
--screen-xl: 1280px;
--screen-2xl: 1536px;
--screen-3xl: 1920px;
--screen-4xl: 2560px;
```

## Component Tokens

### Buttons
```css
--button-height-sm: 32px;
--button-height-default: 40px;
--button-height-lg: 48px;
--button-padding-sm: 0 12px;
--button-padding-default: 0 16px;
--button-padding-lg: 0 24px;
--button-font-size-sm: var(--text-sm);
--button-font-size-default: var(--text-base);
--button-font-size-lg: var(--text-lg);
```

### Inputs
```css
--input-height-sm: 32px;
--input-height-default: 40px;
--input-height-lg: 48px;
--input-padding: 0 12px;
--input-border-width: 1px;
--input-border-radius: var(--radius-md);
--input-font-size: var(--text-base);
```

### Cards
```css
--card-padding: 24px;
--card-border-radius: var(--radius-lg);
--card-shadow: var(--shadow-md);
--card-background: var(--color-background);
--card-border: 1px solid var(--color-neutral-200);
```

## Accessibility Tokens

### Focus States
```css
--focus-ring-width: 2px;
--focus-ring-color: var(--color-primary-500);
--focus-ring-offset: 2px;
--focus-ring: 0 0 0 var(--focus-ring-offset) #fff, 0 0 0 calc(var(--focus-ring-offset) + var(--focus-ring-width)) var(--focus-ring-color);
```

### Contrast Ratios
```css
/* Minimum contrast ratios for WCAG AA compliance */
--contrast-normal-text: 4.5:1;
--contrast-large-text: 3:1;
--contrast-ui-components: 3:1;
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  --duration-instant: 0ms;
  --duration-fast: 0ms;
  --duration-normal: 0ms;
  --duration-slow: 0ms;
  --duration-slower: 0ms;
  --duration-slowest: 0ms;
}
```

## Dark Mode Tokens

### Dark Mode Color Overrides
```css
[data-theme="dark"] {
  --color-background: var(--color-neutral-950);
  --color-background-secondary: var(--color-neutral-900);
  --color-background-tertiary: var(--color-neutral-800);
  
  --color-text-primary: var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-300);
  --color-text-tertiary: var(--color-neutral-400);
  
  --card-background: var(--color-neutral-900);
  --card-border: 1px solid var(--color-neutral-800);
  
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.25);
  --shadow-default: 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
}
```

## Usage Guidelines

### Color Usage
1. **Primary colors** for main CTAs and key interactive elements
2. **Secondary colors** for supporting actions and highlights
3. **Accent colors** for special emphasis and notifications
4. **Semantic colors** for system feedback (success, warning, error)
5. **Neutral colors** for text, borders, and backgrounds

### Typography Hierarchy
1. **Headings**: Use font weights 600-900 with tighter line heights
2. **Body text**: Use font weight 400 with normal line height
3. **Captions**: Use smaller font sizes with increased letter spacing
4. **Emphasis**: Use font weight 500-600 or italic style

### Spacing Principles
1. Use consistent spacing increments based on 8px grid
2. Larger spacing for major sections (32px+)
3. Medium spacing for component groups (16-24px)
4. Small spacing for related elements (8-12px)

### Animation Guidelines
1. Use `ease-out` for enter animations
2. Use `ease-in` for exit animations
3. Keep durations under 350ms for UI feedback
4. Use `prefers-reduced-motion` media query for accessibility

---

*This style guide serves as the foundation for all visual design decisions in the AIRI platform.*