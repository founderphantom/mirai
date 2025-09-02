# Interaction Patterns

## Micro-interactions

### Button Interactions

#### Hover Effects
```javascript
// Primary button hover
{
  transform: 'translateY(-2px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
  duration: 200,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
}

// Secondary button hover
{
  backgroundColor: 'rgba(14, 165, 233, 0.05)',
  borderColor: 'var(--primary-600)',
  duration: 150,
  easing: 'ease-out'
}

// Destructive button hover
{
  backgroundColor: 'var(--error-500)',
  color: 'white',
  duration: 200,
  easing: 'ease-out'
}
```

#### Click Feedback
```javascript
// Press state
{
  transform: 'translateY(0) scale(0.98)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  duration: 100,
  easing: 'ease-in'
}

// Release animation
{
  transform: 'translateY(-2px) scale(1)',
  duration: 150,
  easing: 'spring(1, 80, 10, 0)'
}
```

### Form Interactions

#### Field Focus
```javascript
// Input focus animation
const focusAnimation = {
  borderColor: 'var(--primary-500)',
  boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.1)',
  duration: 200,
  easing: 'ease-out'
}

// Label float animation (Material Design inspired)
const labelFloat = {
  transform: 'translateY(-24px) scale(0.85)',
  color: 'var(--primary-500)',
  duration: 250,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
}
```

#### Validation Feedback
```javascript
// Success state
const validationSuccess = {
  borderColor: 'var(--success-500)',
  iconOpacity: 1,
  iconScale: 'scale(1) from scale(0)',
  duration: 300,
  easing: 'spring(1, 70, 10, 0)'
}

// Error state with shake
const validationError = {
  borderColor: 'var(--error-500)',
  animation: 'shake 0.5s',
  keyframes: {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
  }
}
```

### Loading States

#### Skeleton Screens
```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--neutral-200) 0%,
    var(--neutral-100) 50%,
    var(--neutral-200) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}
```

#### Progress Indicators
```javascript
// Circular progress
const circularProgress = {
  strokeDasharray: '251.2', // 2 * PI * 40 (radius)
  strokeDashoffset: (1 - progress) * 251.2,
  transition: 'stroke-dashoffset 0.5s ease-out',
  strokeLinecap: 'round'
}

// Linear progress
const linearProgress = {
  width: `${progress * 100}%`,
  transition: 'width 0.3s ease-out',
  backgroundImage: 'linear-gradient(90deg, var(--primary-400), var(--primary-600))'
}
```

## Page Transitions

### Route Transitions
```javascript
// Fade transition
const fadeTransition = {
  enter: {
    opacity: 0
  },
  enterActive: {
    opacity: 1,
    transition: 'opacity 0.3s ease-out'
  },
  leave: {
    opacity: 1
  },
  leaveActive: {
    opacity: 0,
    transition: 'opacity 0.2s ease-in'
  }
}

// Slide transition
const slideTransition = {
  enter: {
    transform: 'translateX(20px)',
    opacity: 0
  },
  enterActive: {
    transform: 'translateX(0)',
    opacity: 1,
    transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  leave: {
    transform: 'translateX(0)',
    opacity: 1
  },
  leaveActive: {
    transform: 'translateX(-20px)',
    opacity: 0,
    transition: 'all 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19)'
  }
}
```

### Modal Animations
```javascript
// Modal backdrop
const backdropAnimation = {
  enter: {
    opacity: 0
  },
  enterActive: {
    opacity: 1,
    transition: 'opacity 0.3s ease-out'
  },
  leave: {
    opacity: 1
  },
  leaveActive: {
    opacity: 0,
    transition: 'opacity 0.2s ease-in'
  }
}

// Modal content
const modalAnimation = {
  enter: {
    transform: 'scale(0.9) translateY(20px)',
    opacity: 0
  },
  enterActive: {
    transform: 'scale(1) translateY(0)',
    opacity: 1,
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  leave: {
    transform: 'scale(1) translateY(0)',
    opacity: 1
  },
  leaveActive: {
    transform: 'scale(0.9) translateY(20px)',
    opacity: 0,
    transition: 'all 0.2s cubic-bezier(0.55, 0.055, 0.675, 0.19)'
  }
}
```

## Gesture Interactions

### Swipe Gestures
```javascript
// Swipe to dismiss
const swipeToDismiss = {
  threshold: 100, // pixels
  velocity: 0.3, // pixels per ms
  direction: 'horizontal',
  onSwipe: (direction) => {
    if (direction === 'right') {
      // Dismiss action
      animateOut('translateX(100%)', 300)
    }
  }
}

// Pull to refresh
const pullToRefresh = {
  threshold: 80, // pixels
  maxPull: 120, // pixels
  onPull: (distance) => {
    const progress = Math.min(distance / threshold, 1)
    updateIndicator(progress)
  },
  onRelease: () => {
    if (distance >= threshold) {
      triggerRefresh()
    }
    resetIndicator()
  }
}
```

### Drag and Drop
```javascript
// Draggable element
const draggableConfig = {
  onDragStart: (e) => {
    e.target.style.opacity = '0.5'
    e.target.style.transform = 'scale(1.05)'
  },
  onDragEnd: (e) => {
    e.target.style.opacity = ''
    e.target.style.transform = ''
  },
  onDragOver: (e) => {
    e.preventDefault()
    e.target.classList.add('drag-over')
  },
  onDrop: (e) => {
    e.preventDefault()
    e.target.classList.remove('drag-over')
    handleDrop(e.dataTransfer.files)
  }
}
```

## Feedback Patterns

### Toast Notifications
```javascript
// Toast animation
const toastAnimation = {
  enter: {
    transform: 'translateY(100%)',
    opacity: 0
  },
  enterActive: {
    transform: 'translateY(0)',
    opacity: 1,
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  leave: {
    transform: 'translateY(0)',
    opacity: 1
  },
  leaveActive: {
    transform: 'translateX(100%)',
    opacity: 0,
    transition: 'all 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19)'
  }
}

// Auto-dismiss timer
const autoDismiss = {
  duration: 5000,
  progressBar: true,
  pauseOnHover: true
}
```

### Inline Feedback
```javascript
// Success checkmark animation
const successAnimation = {
  initial: { scale: 0, rotate: 0 },
  animate: {
    scale: [0, 1.2, 1],
    rotate: [0, -10, 0]
  },
  transition: {
    duration: 0.5,
    times: [0, 0.6, 1],
    ease: 'easeOut'
  }
}

// Error message slide in
const errorSlideIn = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' }
}
```

## Accessibility Interactions

### Keyboard Navigation
```javascript
// Focus trap for modals
const focusTrap = {
  firstElement: null,
  lastElement: null,
  
  init(container) {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    this.firstElement = focusable[0]
    this.lastElement = focusable[focusable.length - 1]
  },
  
  handleTab(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === this.firstElement) {
        e.preventDefault()
        this.lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === this.lastElement) {
        e.preventDefault()
        this.firstElement.focus()
      }
    }
  }
}
```

### Screen Reader Announcements
```javascript
// Live region updates
const announceUpdate = (message, priority = 'polite') => {
  const liveRegion = document.getElementById('live-region')
  liveRegion.setAttribute('aria-live', priority)
  liveRegion.textContent = message
  
  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = ''
  }, 1000)
}

// Loading state announcements
const announceLoading = {
  start: () => announceUpdate('Loading, please wait'),
  success: (message) => announceUpdate(message || 'Action completed successfully'),
  error: (message) => announceUpdate(message || 'An error occurred', 'assertive')
}
```