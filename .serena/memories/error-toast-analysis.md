# Error Toast Flow Analysis - Why 503 Errors Don't Show Toasts

## Summary
Error toasts are **only triggered via `scheduleRetry()`** in the `bootAndStart()` function during quiz startup. Errors during answer submission call `onError?.(apiError, retry)` which *should* show a toast but may not due to timing or dispatch issues.

## Error Handling Flow

### 1. ERROR Action in playReducer.ts (Lines 90-103)
- Stores error message in `state.error`
- Sets `loading: false`
- **Does NOT trigger any toast display**
- Preserves existing question if one exists

### 2. Two Places Where `s.error` is Rendered (play/page.tsx)

#### Before Quiz Starts (Line 394)
```typescript
{!s.started ? (
  ...
  {s.error ? <div className="mb-3 text-red-700">{s.error}</div> : null}
```
- Only shown when quiz hasn't started
- Inline error text (not a toast)

#### During Active Quiz (Line 404)
```typescript
{s.error ? <ErrorBanner message={s.error} /> : null}
```
- Shows ErrorBanner component
- Not a toast notification

### 3. Toast is ONLY Called via scheduleRetry()

In `bootAndStart()` catch block (Lines 211-220):
```typescript
catch (e: unknown) {
  if (!isMountedRef.current) return;
  const apiError = ensureApiError(e);
  const errorMessage = mapApiErrorToMessage(apiError);
  safeDispatch({ type: 'ERROR', error: errorMessage });   // Store in state
  scheduleRetry(apiError, () => {                          // CALLS showToast()
    safeDispatch({ type: 'BOOTING' });
    void bootAndStart(params);
  });
}
```

The `scheduleRetry()` function (Lines 87-108) calls `showToast()`:
```typescript
const scheduleRetry = React.useCallback(
  (error: ApiError, retryFn: () => void) => {
    let message = mapApiErrorToMessage(error);
    if (error.code === 'no_questions') {
      message = t('error.noQuestions');
    }
    const wrappedRetry = () => {
      pendingRetryRef.current = null;
      retryFn();
    };
    showToast(message, {              // ← SHOWS TOAST WITH RETRY ACTION
      actionLabel: t('toast.retry'),
      onAction: wrappedRetry,
      variant: 'error',
    });
    if (error.kind === 'offline') {
      pendingRetryRef.current = wrappedRetry;
    }
  },
  [showToast, t]
);
```

## Why 503 Errors from /v1/rounds/start Don't Show Toasts

If `bootAndStart()` throws a 503 error:
1. ✅ Error IS caught (line 211)
2. ✅ Error IS dispatched via `safeDispatch({ type: 'ERROR', ... })`
3. ✅ `scheduleRetry()` IS called (line 217)
4. ✅ `showToast()` IS called inside `scheduleRetry()` (line 98)

**The toast SHOULD appear** unless:
- `isMountedRef.current` is `false` (component unmounted)
- Toast state isn't being rendered (line 456-466)
- Browser dev tools don't show it

## Errors During Answer Submission

In `useAnswerProcessor.ts` (Lines 197-204):
```typescript
catch (e: unknown) {
  const apiError = ensureApiError(e, 'Failed to load next.');
  const message = mapApiErrorToMessage(apiError);
  dispatch({ type: 'ERROR', error: message });    // Store error in state
  const retry = () => {
    void process(mode);
  };
  onError?.(apiError, retry);                     // Call scheduleRetry via prop
}
```

- Error dispatched to state
- `onError` callback called (which is `scheduleRetry` passed as prop on line 259)
- Should show toast with retry button

## Key Files

| File | Role |
|------|------|
| `/web/src/features/quiz/playReducer.ts` | Reducer handling ERROR action (stores in state only) |
| `/web/app/play/page.tsx` | Main page rendering errors via ErrorBanner + toast |
| `/web/src/features/quiz/useAnswerProcessor.ts` | Answer processing with error callback |
| `/web/src/components/Toast.tsx` | Toast component with auto-dismiss |

## Toast Component Location
- File: `/web/src/components/Toast.tsx`
- Position: Fixed bottom-center (zIndex: 40)
- Auto-dismisses after 5 seconds by default
- Supports retry action button

## Debugging Steps
1. Check if `showToast()` is being called (add console.log)
2. Verify `isMountedRef.current` is `true`
3. Check if toast state is being rendered (line 456)
4. Inspect CSS z-index conflicts (should be 40)
5. Verify Toast component receives correct props
