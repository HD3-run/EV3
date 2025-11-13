# Authentication Architecture Guide

## Overview

This application uses a **dual authentication system** combining **Phantom Tokens** with **Session-based authentication** for enhanced security while maintaining backward compatibility.

## Authentication Flow

### 1. Login/Registration
```
User → Frontend → Backend
                    ↓
              Creates Session
                    ↓
         Generates Phantom Token
                    ↓
    Returns: { user, token (phantom) }
                    ↓
Frontend stores both in:
- localStorage: auth_token
- Session cookie: connect.sid
```

### 2. API Requests
```
Frontend → Adds Authorization: Bearer <phantom_token>
        → Includes credentials (session cookie)
                    ↓
              Backend Middleware
                    ↓
    Tries Phantom Token first
                    ↓
    Falls back to Session if no token
                    ↓
         Validates & Proceeds
```

## Security Benefits

### Phantom Token Pattern
- **Opaque tokens** sent to client (not JWTs)
- Client cannot decode or inspect token contents
- Backend resolves phantom token → JWT internally
- Reduces attack surface (no JWT exposure to client)

### JWT (Internal Only)
- Short-lived (5 minutes)
- Contains: userId, role, merchant_id
- Validated with issuer/audience checks
- Algorithm locked to HS256 (prevents algorithm confusion attacks)

### Session (Fallback)
- HttpOnly cookies (XSS protection)
- SameSite=lax (CSRF protection)
- 24-hour expiration
- Backward compatible with existing code

## Implementation Details

### Backend

#### Token Generation (`utils/jwt.ts`)
```typescript
// Creates phantom token + JWT pair
createPhantomTokenPair(userPayload) → { phantomToken, jwt }

// Phantom token: 64-char hex string (opaque)
// JWT: Short-lived, internal use only
```

#### Authentication Middleware (`middleware/auth.ts`)
```typescript
authenticateUser(req, res, next)
  1. Check Authorization header for phantom token
  2. Resolve phantom → JWT → validate
  3. Fallback to session if no token
  4. Attach user data to req.user
  5. Continue or reject (401)
```

#### Routes (`routes.ts`)
- `/api/auth/login` → Returns phantom token
- `/api/auth/register` → Returns phantom token
- All protected routes use `authenticateUser` middleware

### Frontend

#### Auth Context (`context/AuthContext.tsx`)
```typescript
- Stores: user, token (phantom)
- Provides: getAuthHeaders() helper
- Auto-includes token in all API calls
```

#### Custom Hook (`hooks/useAuthFetch.ts`)
```typescript
useAuthFetch()
  - Wraps fetch with authentication
  - Auto-adds Authorization header
  - Includes credentials for session fallback
```

#### Usage Example
```typescript
const authFetch = useAuthFetch();

// Automatically authenticated
const response = await authFetch('/api/orders', {
  method: 'GET'
});
```

## Migration Path

### Current State ✅
- Session-based auth working
- Phantom tokens generated but not used
- All API calls use session only

### After This Update ✅
- Phantom tokens stored and sent
- Backend validates phantom tokens first
- Session remains as fallback
- **No breaking changes** - existing sessions still work

### Future Enhancements (Optional)
- Refresh token rotation
- Token revocation list (Redis)
- Rate limiting per token
- Device fingerprinting

## Configuration

### Environment Variables
```bash
# Required
JWT_SECRET=your-secret-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production

# Optional
JWT_ISSUER=ecommitra-api
JWT_AUDIENCE=ecommitra-client
```

### Token Lifetimes
- **Phantom Token**: 15 minutes
- **JWT**: 5 minutes (internal)
- **Session**: 24 hours

## Security Checklist

- [x] Phantom tokens are opaque (not JWTs)
- [x] JWTs never sent to client
- [x] Short token lifetimes
- [x] HttpOnly session cookies
- [x] SameSite cookie protection
- [x] Algorithm locked (HS256)
- [x] Issuer/audience validation
- [x] Automatic token cleanup
- [x] Session fallback for compatibility

## Testing

### Test Phantom Token Auth
```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrPhone":"user@example.com","password":"password"}' \
  -c cookies.txt

# Response includes: { token: "phantom_token_here" }

# 2. Use phantom token
curl http://localhost:5000/api/orders \
  -H "Authorization: Bearer <phantom_token>" \
  -b cookies.txt
```

### Test Session Fallback
```bash
# Without Authorization header (uses session only)
curl http://localhost:5000/api/orders \
  -b cookies.txt
```

## Troubleshooting

### Token Not Working
1. Check localStorage has `auth_token`
2. Verify Authorization header is sent
3. Check backend logs for validation errors
4. Ensure token hasn't expired (15 min)

### Session Not Working
1. Check cookies are enabled
2. Verify `credentials: 'include'` in fetch
3. Check CORS allows credentials
4. Ensure session secret is set

### Both Failing
1. Check user exists in database
2. Verify middleware is applied to route
3. Check for CORS issues
4. Review backend logs for errors

## Best Practices

### Frontend
- Always use `useAuthFetch()` hook for API calls
- Don't manually manage tokens
- Let AuthContext handle token lifecycle
- Check `isValidating` before rendering protected content

### Backend
- Use `authenticateUser` middleware on all protected routes
- Don't expose JWT to client
- Keep token lifetimes short
- Log authentication failures for monitoring

### Security
- Rotate JWT_SECRET regularly
- Use HTTPS in production
- Implement rate limiting
- Monitor for suspicious token usage
- Clear tokens on logout

## Performance

### Token Storage
- In-memory Map (development)
- Redis recommended (production)
- Automatic cleanup every 5 minutes

### Caching
- User data cached for 5 minutes
- Reduces database queries
- Invalidated on logout

## Compatibility

### Browsers
- All modern browsers (ES6+)
- localStorage required
- Cookies required

### Mobile
- React Native compatible
- AsyncStorage instead of localStorage
- Same API structure

## Summary

This dual authentication system provides:
1. **Enhanced security** via phantom tokens
2. **Backward compatibility** via sessions
3. **Zero breaking changes** to existing code
4. **Future-proof** architecture for scaling

All user data continues to load correctly because:
- Sessions still work as before
- Phantom tokens add extra security layer
- Middleware tries both methods
- No API changes required
