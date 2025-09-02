# Component Specifications

## Sign Out Button

### Location
- **Page**: `/settings`
- **Section**: Account Management (bottom of settings menu)
- **Position**: Below all other settings options, separated by divider

### Visual Design
```css
.sign-out-button {
  /* Dimensions */
  width: 100%;
  max-width: 320px;
  height: 48px;
  
  /* Styling */
  background: transparent;
  border: 2px solid var(--error-500);
  border-radius: var(--radius-xl);
  
  /* Typography */
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--error-500);
  
  /* Spacing */
  padding: var(--space-3) var(--space-6);
  margin-top: var(--space-8);
  
  /* Transitions */
  transition: all var(--duration-200) var(--ease-out);
}

.sign-out-button:hover {
  background: var(--error-500);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.sign-out-button:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.sign-out-button:focus-visible {
  outline: 2px solid var(--error-500);
  outline-offset: 2px;
}
```

### Icon Integration
```html
<button class="sign-out-button">
  <svg class="sign-out-icon" width="20" height="20">
    <!-- Icon: solar:logout-2-bold-duotone -->
  </svg>
  <span>Sign Out</span>
</button>
```

### States
1. **Default**: Transparent background, red border and text
2. **Hover**: Red background, white text, subtle elevation
3. **Active**: Pressed state with reduced elevation
4. **Focus**: Visible focus ring for keyboard navigation
5. **Loading**: Spinner replacing icon during sign out process
6. **Disabled**: Reduced opacity (0.5) during processing

### Interaction Flow
```
Click → Confirmation Modal → Loading State → Sign Out → Redirect to Landing
```

### Confirmation Modal
```css
.sign-out-modal {
  /* Positioning */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  
  /* Dimensions */
  width: 90%;
  max-width: 400px;
  
  /* Styling */
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-2xl);
}

.modal-content {
  text-align: center;
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-3);
}

.modal-description {
  font-size: var(--text-base);
  color: var(--neutral-600);
  margin-bottom: var(--space-6);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}
```

---

## Start New Chat Button

### Location
- **Page**: `/dashboard`
- **Position**: Center of empty state OR top-right of chat list
- **Visibility**: Always visible, primary CTA

### Visual Design
```css
.start-chat-button {
  /* Dimensions */
  height: 56px;
  min-width: 200px;
  
  /* Styling */
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border: none;
  border-radius: var(--radius-full);
  
  /* Typography */
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: white;
  
  /* Spacing */
  padding: var(--space-4) var(--space-8);
  
  /* Effects */
  box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.4);
  transition: all var(--duration-300) var(--ease-out);
}

.start-chat-button:hover {
  background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(14, 165, 233, 0.5);
}

.start-chat-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px 0 rgba(14, 165, 233, 0.3);
}

.start-chat-button:focus-visible {
  outline: 3px solid var(--primary-300);
  outline-offset: 3px;
}

/* Icon animation */
.start-chat-icon {
  display: inline-block;
  margin-right: var(--space-2);
  transition: transform var(--duration-300) var(--ease-out);
}

.start-chat-button:hover .start-chat-icon {
  transform: rotate(15deg) scale(1.1);
}
```

### Component Structure
```html
<button class="start-chat-button">
  <svg class="start-chat-icon" width="24" height="24">
    <!-- Icon: solar:chat-round-dots-bold-duotone -->
  </svg>
  <span>Start New Chat</span>
</button>
```

### Responsive Behavior
```css
/* Mobile (< 640px) */
@media (max-width: 639px) {
  .start-chat-button {
    position: fixed;
    bottom: var(--space-6);
    right: var(--space-6);
    z-index: var(--z-fixed);
    
    /* Floating Action Button style */
    width: 64px;
    height: 64px;
    padding: 0;
    border-radius: 50%;
  }
  
  .start-chat-button span {
    display: none; /* Hide text on mobile */
  }
  
  .start-chat-icon {
    margin: 0;
    width: 28px;
    height: 28px;
  }
}
```

### Empty State Integration
```css
.empty-state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.empty-state-illustration {
  width: 240px;
  height: 240px;
  margin-bottom: var(--space-8);
  opacity: 0.8;
}

.empty-state-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-3);
}

.empty-state-description {
  font-size: var(--text-base);
  color: var(--neutral-600);
  margin-bottom: var(--space-8);
  max-width: 400px;
}
```

### Animation Sequence
```css
@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.start-chat-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  animation: pulse-ring 2s infinite;
  pointer-events: none;
}
```

---

## Authentication Forms

### Sign In Form
```css
.auth-form {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.form-field {
  margin-bottom: var(--space-5);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--neutral-700);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  height: 48px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  border: 2px solid var(--neutral-300);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  transition: all var(--duration-200) var(--ease-out);
}

.form-input:focus {
  border-color: var(--primary-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.form-input:invalid:not(:placeholder-shown) {
  border-color: var(--error-500);
}

.form-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--error-500);
}

.submit-button {
  width: 100%;
  height: 48px;
  margin-top: var(--space-6);
  background: var(--primary-500);
  color: white;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-200) var(--ease-out);
}

.submit-button:hover:not(:disabled) {
  background: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Password Field Enhancement
```css
.password-field {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--neutral-500);
  cursor: pointer;
  padding: var(--space-2);
}

.password-toggle:hover {
  color: var(--neutral-700);
}

.password-strength {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.strength-bar {
  flex: 1;
  height: 3px;
  background: var(--neutral-200);
  border-radius: var(--radius-full);
  transition: background var(--duration-300) var(--ease-out);
}

.strength-bar.active {
  background: var(--success-500);
}
```