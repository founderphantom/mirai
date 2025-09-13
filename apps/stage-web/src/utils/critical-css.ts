/**
 * Critical CSS extraction and inlining utilities
 * Extracts above-the-fold CSS for faster initial render
 */

/**
 * Critical CSS for above-the-fold content
 * This will be inlined in the HTML head
 */
export const CRITICAL_CSS = `
  /* Reset and base styles */
  *, ::before, ::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
    border-color: currentColor;
  }
  
  html {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    -moz-tab-size: 4;
    tab-size: 4;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-feature-settings: normal;
    font-variation-settings: normal;
    -webkit-tap-highlight-color: transparent;
  }
  
  body {
    margin: 0;
    line-height: inherit;
  }
  
  /* Critical layout styles */
  #app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  /* Dark mode critical styles */
  :root {
    --bg-color-light: rgb(255 255 255);
    --bg-color-dark: rgb(18 18 18);
    --bg-color: var(--bg-color-light);
  }
  
  html.dark {
    --bg-color: var(--bg-color-dark);
    color-scheme: dark;
    background: rgb(18 18 18);
    color: rgb(255 255 255);
  }
  
  /* Prevent FOUC (Flash of Unstyled Content) */
  .font-sans {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  
  /* Critical viewport and mobile styles */
  html, body, #app {
    height: 100%;
    margin: 0;
    padding: 0;
    overscroll-behavior: none;
  }
  
  /* Prevent layout shift on mobile */
  * {
    touch-action: manipulation;
  }
  
  /* Loading state styles */
  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg-color);
  }
  
  .app-loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  html.dark .app-loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #60a5fa;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Critical typography */
  h1, h2, h3, h4, h5, h6 {
    font-size: inherit;
    font-weight: inherit;
    margin: 0;
  }
  
  a {
    color: inherit;
    text-decoration: inherit;
  }
  
  button, input, optgroup, select, textarea {
    font-family: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    font-size: 100%;
    font-weight: inherit;
    line-height: inherit;
    color: inherit;
    margin: 0;
    padding: 0;
  }
  
  /* Prevent CLS from images */
  img, svg, video, canvas, audio, iframe, embed, object {
    display: block;
    max-width: 100%;
    height: auto;
  }
  
  /* Aspect ratio utilities for preventing layout shift */
  [data-aspect-ratio] {
    position: relative;
    width: 100%;
  }
  
  [data-aspect-ratio]::before {
    content: "";
    display: block;
    padding-bottom: var(--aspect-ratio, 56.25%);
  }
  
  [data-aspect-ratio] > * {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`

/**
 * Extract critical CSS from existing stylesheets
 * This function should be run during build time
 */
export function extractCriticalCSS(html: string, css: string): string {
  // This is a simplified version - in production, use a tool like critical or penthouse
  // For now, return our predefined critical CSS
  return CRITICAL_CSS
}

/**
 * Generate inline style tag for critical CSS
 */
export function generateCriticalStyleTag(): string {
  const minified = CRITICAL_CSS
    .replace(/\s+/g, ' ')
    .replace(/:\s+/g, ':')
    .replace(/;\s+/g, ';')
    .replace(/\{\s+/g, '{')
    .replace(/\}\s+/g, '}')
    .replace(/\s+\{/g, '{')
    .replace(/\}\s+/g, '}')
    .trim()
  
  return `<style id="critical-css">${minified}</style>`
}

/**
 * Preload non-critical CSS
 */
export function preloadCSS(href: string): string {
  return `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${href}"></noscript>`
}

/**
 * Generate resource hints for critical resources
 */
export function generateResourceHints(): string {
  return `
    <!-- DNS Prefetch for third-party domains -->
    <link rel="dns-prefetch" href="https://fonts.googleapis.com">
    <link rel="dns-prefetch" href="https://fonts.gstatic.com">
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    
    <!-- Preconnect to critical domains -->
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    
    <!-- Prefetch critical chunks (will be updated by build process) -->
    <link rel="prefetch" href="/js/vendor-core.js" as="script">
    <link rel="modulepreload" href="/js/vendor-core.js">
  `.trim()
}