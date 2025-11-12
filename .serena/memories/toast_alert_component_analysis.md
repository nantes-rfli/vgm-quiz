# Toast/Alert Component Analysis

## Component Location
- **Main Component**: `/Users/nanto/Development/vgm-quiz/web/src/components/Toast.tsx`
- **Error Banner**: `/Users/nanto/Development/vgm-quiz/web/src/components/ErrorBanner.tsx`
- **Error Utilities**: `/Users/nanto/Development/vgm-quiz/web/src/features/quiz/api/errors.ts`

## Toast Component Implementation

### File: `src/components/Toast.tsx`
The main toast notification component with the following features:

**Props**:
- `message: string` - The notification message to display
- `actionLabel?: string` - Optional action button label
- `onAction?: () => void` - Callback when action button is clicked
- `onClose?: () => void` - Callback to close the toast
- `duration?: number` - Auto-dismiss duration (default: 5000ms)
- `variant?: 'info' | 'error'` - Visual style (default: 'info')
- `closeLabel?: string` - Accessibility label for close button (default: 'Close')

**Key Features**:
1. **ARIA Compliance** (lines 41-42):
   - `role="alert"` - Semantic alert role for accessibility
   - `aria-live="assertive"` - Announces toast immediately to screen readers
   - `aria-label={closeLabel}` - Accessible label on close button

2. **Auto-dismiss** (lines 24-30):
   - Uses `useEffect` to automatically dismiss after specified duration
   - Duration is configurable; `duration: 0` disables auto-dismiss

3. **Styling** (lines 32-37):
   - Error variant: Red background (`bg-red-600`) with white text and red border
   - Info variant: Dark gray background (`bg-gray-900`) with white text
   - Fixed positioning at bottom-center of screen
   - `z-index: 40` for proper layering

4. **Test Identifier**: `data-testid="toast-notification"` for E2E testing

## Error Message Handling

### Error Flow
1. **Error Capture** → `ensureApiError()` (api/errors.ts)
2. **Message Mapping** → `mapApiErrorToMessage()` (api/errors.ts)
3. **Display via Toast** → `showToast()` in play/page.tsx
4. **Optional Retry** → Action button with retry callback

### Error Types & Messages

**ApiErrorKind Enum** (api/errors.ts):
- `offline` - No internet connection
- `timeout` - Request took too long
- `network` - Network connectivity issue
- `server` - Server-side error (5xx)
- `client` - Client error (4xx)
- `decode` - Invalid response format
- `abort` - Request cancelled
- `unknown` - Unclassified error

**Error Message Mapping** (api/errors.ts, mapApiErrorToMessage):
- Offline: "You appear to be offline. Check your internet connection and try again."
- Timeout: "The request is taking longer than expected. Please retry in a moment."
- Network: "We could not reach the server. Please verify your connection and try again."
- Server errors with special handling:
  - `code: 'no_questions'`: "Not enough questions available for this condition."
  - HTTP 429 (Rate limit): "The request rate limit was reached. Please wait a few seconds and try again."
  - HTTP 503 (Unavailable): "The service is temporarily unavailable. Please try again shortly."
  - Other server: "The server encountered an error (HTTP {status}). Please try again shortly."
- Client errors: "Your request could not be processed. Please refresh the page and try again."
- Decode errors: "Received an unexpected response from the server. Please retry."
- Abort: "The request was cancelled. Please try again."

## Error Display in Play Page

### Implementation Location: `app/play/page.tsx`

**Toast State Management** (lines 44-51):
```typescript
type ToastState = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  variant: 'info' | 'error';
  duration: number;
};
```

**showToast Method** (lines 66-81):
- Creates unique toast with `Date.now()` as ID
- Accepts options: `actionLabel`, `onAction`, `variant`, `duration`
- Default variant is 'error'
- Default duration is 5000ms

**Error Handling in API Calls** (lines 88-108):
- `scheduleRetry()` method handles API errors
- Maps error to user-friendly message via `mapApiErrorToMessage()`
- For offline errors: stores retry function and auto-retry on 'online' event
- Shows toast with retry action button for retryable errors
- Uses i18n for error messages: `t('error.noQuestions')`, `t('toast.retry')`, `t('toast.close')`

**Error Display Locations**:
1. **Toast Notification** (lines 456-466): Shows at bottom-center with optional retry action
2. **Error Banner** (line 404): `ErrorBanner` component for inline error display
3. **Error State in Reducer** (line 176, 216): Stores error message in reducer state

### Usage in Answer Processing: `useAnswerProcessor.ts`

**Error Handling** (lines 197-205):
- Catches API errors from `next()` call
- Maps error to user message via `mapApiErrorToMessage()`
- Dispatches ERROR action to reducer
- Calls `onError` callback with ApiError and retry function
- Retry function re-invokes the answer processing

## Accessibility Features

1. **Alert Role**: `role="alert"` announces toast to screen readers
2. **Live Region**: `aria-live="assertive"` ensures immediate announcement
3. **Close Button Label**: `aria-label` for screen reader users
4. **Semantic HTML**: Uses native button elements with proper types
5. **Test Identifier**: `data-testid="toast-notification"` for automated testing

## Error Display Summary

### Two Complementary Components:
1. **Toast** - Floating notification for errors with retry action
   - Used for network/API errors
   - Shows at bottom-center
   - Auto-dismisses or requires user interaction
   
2. **ErrorBanner** - Inline error display in main content area
   - Used for general error messages
   - Styled as red box with red border
   - Always visible until cleared
