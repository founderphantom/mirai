# Authentication Flow Test Guide

## Test Scenarios

### 1. Sign Out from Settings Page

#### Test Steps:
1. Navigate to `/settings` page while authenticated
2. Scroll to the bottom of the settings menu
3. Verify the Sign Out button is visible with:
   - Red border and text color
   - Logout icon (solar:logout-2-bold-duotone)
   - Proper hover effects (red background, white text)

#### Sign Out Confirmation Modal:
1. Click the Sign Out button
2. Verify modal appears with:
   - Title: "Sign Out?"
   - Description: "Are you sure you want to sign out? You'll need to sign in again to access your account."
   - Cancel button (closes modal)
   - Sign Out button (danger variant)
3. Click Cancel - modal should close, user remains signed in
4. Click Sign Out button again
5. Click Sign Out in modal:
   - Loading state should show
   - User should be signed out
   - Redirect to `/auth/login`
   - Success toast: "Signed out successfully"

### 2. Start New Chat Button - Dashboard

#### Empty State (No Chats):
1. Navigate to `/dashboard` with no existing chats
2. Verify empty state displays:
   - Chat icon illustration
   - Title: "No conversations yet"
   - Description: "Start a new chat with AIRI to begin your journey together"
   - Primary CTA button: "Start New Chat"
   - Button has gradient blue background
   - Pulse animation on button
   - Hover effects (elevation, icon rotation)
3. Click "Start New Chat":
   - Should navigate to `/chat/new`
   - Success toast: "New chat started"

#### With Existing Chats (Desktop):
1. Navigate to `/dashboard` with existing chats
2. Verify button appears at top-right of chat list
3. Button should have:
   - Gradient blue background
   - "Start New Chat" text with icon
   - Hover effects

#### Mobile View (< 640px):
1. View dashboard on mobile device/responsive mode
2. With existing chats, verify:
   - Floating Action Button (FAB) appears
   - Fixed position bottom-right (bottom: 24px, right: 24px)
   - Circular button (64x64px)
   - Only icon visible (no text)
   - Pulse animation effect
3. Click FAB:
   - Should navigate to `/chat/new`
   - Success toast: "New chat started"

### 3. Error Handling

#### Sign Out Error:
1. Simulate network error during sign out
2. Verify error toast: "Failed to sign out. Please try again."
3. Modal should remain open
4. User should remain signed in

#### Protected Routes:
1. Try accessing `/dashboard` without authentication
2. Should redirect to `/auth/login`
3. Query parameter should contain redirect path

### 4. Accessibility Tests

#### Keyboard Navigation:
1. Tab through settings page
2. Sign Out button should be focusable
3. Enter/Space should open modal
4. Escape should close modal
5. Tab should cycle through modal buttons

#### Screen Reader:
1. Sign Out button should have proper ARIA labels
2. Modal should announce when opened
3. FAB should have aria-label="Start New Chat"

### 5. Visual Regression

#### Light Mode:
- Sign Out button: Red border/text on white background
- Start New Chat: Blue gradient button
- Proper contrast ratios

#### Dark Mode:
- Sign Out button: Red border/text on dark background
- Start New Chat: Blue gradient maintains visibility
- Proper contrast in dark theme

## Expected Behaviors

### Sign Out Flow:
```
User clicks Sign Out → Modal Opens → User Confirms → Loading State → Sign Out Success → Redirect to Login
```

### New Chat Flow:
```
User clicks Start New Chat → Navigate to /chat/new → Chat Interface Opens → Success Toast
```

## Integration Points to Verify

1. **Authentication State**: 
   - `useAuth()` composable properly tracks user state
   - Session cleared on sign out
   - Redirect works correctly

2. **i18n Translations**:
   - All text uses translation keys
   - Translations load properly from `@proj-airi/i18n`

3. **Toast Notifications**:
   - Success/error toasts appear correctly
   - Using `vue-sonner` library

4. **Responsive Design**:
   - FAB appears only on mobile when chats exist
   - Desktop button layout adjusts properly
   - Empty state centers correctly

## Browser Compatibility

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)