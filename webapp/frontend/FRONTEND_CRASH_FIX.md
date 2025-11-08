# Frontend Crash Fix - GPS Widget Null Reference

## Issue

The webapp was loading briefly then crashing with a blank screen when accessed from remote PC.

### Error Message
```
TypeError: Cannot read properties of null (reading 'toFixed')
    at VK (GPSWidget.tsx:125:38)
```

## Root Cause

The GPS widget was checking for `undefined` but not handling `null` values:

```typescript
// OLD CODE (BROKEN)
{data.course_deg !== undefined && (
  <span>{data.course_deg.toFixed(1)}°</span>  // crashes if course_deg is null
)}
```

When GPS data comes in with `null` values (common when GPS has no fix), the component crashed because:
- `null !== undefined` returns `true`
- Code proceeds to call `.toFixed()` on `null`
- JavaScript throws TypeError

## Fix Applied

Changed null checks to handle both `null` and `undefined`:

```typescript
// NEW CODE (FIXED)
{data.course_deg != null && (  // != null checks for both null and undefined
  <span>{data.course_deg.toFixed(1)}°</span>
)}
```

### Files Modified

**[GPSWidget.tsx](src/components/dashboard/widgets/GPSWidget.tsx)** - Lines 110-131

Changed 4 checks:
1. Line 110: `data.speed_mps !== undefined` → `data.speed_mps != null`
2. Line 110: `data.course_deg !== undefined` → `data.course_deg != null`
3. Line 113: `data.speed_mps !== undefined` → `data.speed_mps != null`
4. Line 121: `data.course_deg !== undefined` → `data.course_deg != null`

## Why This Happens

GPS data can be:
- `undefined` - Property not present in object
- `null` - Explicitly no value (common in GPS when no fix)
- `0` - Valid zero value
- `number` - Valid GPS reading

The safeguard `!= null` (loose equality with `null`) catches both:
- `null != null` → `false` (blocks rendering)
- `undefined != null` → `false` (blocks rendering)
- `0 != null` → `true` (allows rendering)
- `123.45 != null` → `true` (allows rendering)

## Testing

After this fix:
1. Frontend should load without crashing
2. GPS widget displays "NO_FIX" when GPS has no signal
3. Motion data (speed/course) only displays when valid
4. No console errors about `.toFixed()`

## Prevention

To prevent similar issues in future:

### 1. Use Null-Safe Checks
```typescript
// ✓ GOOD - handles both null and undefined
if (value != null) { ... }

// ✗ BAD - only checks undefined
if (value !== undefined) { ... }
```

### 2. Optional Chaining
```typescript
// ✓ GOOD - safe even if null/undefined
{data.course_deg?.toFixed(1)}

// ✗ BAD - crashes on null
{data.course_deg.toFixed(1)}
```

### 3. Nullish Coalescing
```typescript
// ✓ GOOD - provides fallback
{(data.course_deg ?? 0).toFixed(1)}

// ✗ BAD - no fallback
{data.course_deg.toFixed(1)}
```

### 4. Type Guards
```typescript
// ✓ GOOD - explicit type narrowing
{typeof data.course_deg === 'number' && (
  <span>{data.course_deg.toFixed(1)}</span>
)}
```

## Related Warnings (Non-Critical)

The console also showed warnings about browser APIs not available:
```
Could not disable access to Bluetooth because of error ReferenceError: Bluetooth is not defined
Could not disable access to USB because of error ReferenceError: USB is not defined
Could not disable access to Serial because of error ReferenceError: Serial is not defined
Could not disable access to HID because of error ReferenceError: HID is not defined
```

**These are warnings, not errors.** They occur because:
- Your browser may not support Web Bluetooth/USB/Serial/HID APIs
- These are experimental browser features not needed for core functionality
- Can be safely ignored or suppressed in production build

## Additional Notes

### Vite HMR
The fix should auto-reload in your browser since Vite has Hot Module Replacement (HMR) enabled. If not:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear cache and reload
3. Restart frontend: `pkill -f vite && npm run dev`

### Backend Connection
The log shows:
```
useWebSocket.ts:36 WebSocket connected
useWebSocket.ts:52 WebSocket disconnected: 1000 Client disconnect
```

This is normal when the page crashes and reloads. After the fix, WebSocket should stay connected.

### ThreeJS Context Lost
```
THREE.WebGLRenderer: Context Lost.
```

This happens when the page crashes. After fix, the 3D visualization (Cesium/Three.js) should remain stable.

## Verification

To verify the fix worked:

1. **Clear browser cache** and reload: `Ctrl+Shift+R`
2. **Check console** - should NOT see `.toFixed()` error
3. **Check GPS widget** - should display without crashing
4. **Wait for GPS data** - widget updates when telemetry arrives
5. **WebSocket** - should show "connected" and stay connected

## Future Improvements

Consider adding defensive programming throughout:

1. **Default Props**
```typescript
interface GPSWidgetProps {
  data: GPSFix | null
}

export function GPSWidget({ data }: GPSWidgetProps) {
  if (!data) {
    return <div>No GPS data</div>
  }
  // ... rest of component
}
```

2. **Error Boundaries**
Wrap components in React Error Boundaries to catch crashes gracefully.

3. **TypeScript Strict Mode**
Enable `strictNullChecks` in `tsconfig.json` to catch these at compile time.

4. **ESLint Rules**
Add rules to catch unsafe member access:
```json
"@typescript-eslint/no-unsafe-member-access": "error",
"@typescript-eslint/no-unsafe-call": "error"
```

## Status

✅ **Fixed** - Frontend should now load and stay loaded
✅ **No rebuild required** - Vite HMR auto-reloads
✅ **Network accessible** - Works from remote PC
⚠️ **GPS may show NO_FIX** - Normal when GPS doesn't have satellite lock
ℹ️ **Browser API warnings** - Safe to ignore

---

**Fix applied:** 2025-10-12
**Files modified:** 1 (GPSWidget.tsx)
**Lines changed:** 4 null checks
**Impact:** Critical - prevents complete UI crash
