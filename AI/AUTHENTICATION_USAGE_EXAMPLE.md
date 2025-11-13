# Authentication Usage Examples

## Using the New Authentication System

### Example 1: Simple API Call with useAuthFetch

```typescript
import { useAuthFetch } from '../hooks/useAuthFetch';

function OrdersComponent() {
  const authFetch = useAuthFetch();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadOrders = async () => {
      // Automatically includes phantom token + session
      const response = await authFetch('/api/orders');
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    };

    loadOrders();
  }, []);

  return <div>{/* render orders */}</div>;
}
```

### Example 2: POST Request with Authentication

```typescript
import { useAuthFetch } from '../hooks/useAuthFetch';

function CreateOrderComponent() {
  const authFetch = useAuthFetch();

  const handleSubmit = async (orderData) => {
    const response = await authFetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (response.ok) {
      alert('Order created!');
    }
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

### Example 3: Checking Authentication Status

```typescript
import { useAuth } from '../context/AuthContext';

function ProtectedComponent() {
  const { user, isValidating, token } = useAuth();

  if (isValidating) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <p>Role: {user.role}</p>
      <p>Auth Status: {token ? 'Token Active' : 'Session Only'}</p>
    </div>
  );
}
```

### Example 4: Manual Fetch (Not Recommended)

If you need to use fetch directly without the hook:

```typescript
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

function ManualFetchComponent() {
  const { getAuthHeaders } = useAuth();

  const loadData = async () => {
    const response = await fetch(getApiUrl('/api/data'), {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include', // Important for session fallback
    });

    if (response.ok) {
      const data = await response.json();
      // process data
    }
  };

  return <button onClick={loadData}>Load Data</button>;
}
```

## Migration Guide for Existing Components

### Before (Old Way - Still Works!)
```typescript
const response = await fetch(getApiUrl('/api/orders'), {
  credentials: 'include',
});
```

### After (New Way - Recommended)
```typescript
const authFetch = useAuthFetch();
const response = await authFetch('/api/orders');
```

### Why Migrate?
1. **Automatic token management** - No manual header setup
2. **Better security** - Phantom tokens included automatically
3. **Cleaner code** - Less boilerplate
4. **Future-proof** - Ready for token refresh, etc.

## Common Patterns

### Pattern 1: Loading Data on Mount
```typescript
const authFetch = useAuthFetch();

useEffect(() => {
  authFetch('/api/data')
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => console.error(err));
}, []);
```

### Pattern 2: Form Submission
```typescript
const authFetch = useAuthFetch();

const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const response = await authFetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    
    if (response.ok) {
      // Success
    } else {
      // Handle error
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### Pattern 3: Conditional Rendering Based on Auth
```typescript
const { user, isValidating } = useAuth();

if (isValidating) return <Spinner />;
if (!user) return <Navigate to="/login" />;

return <ProtectedContent />;
```

## Error Handling

### Handle 401 Unauthorized
```typescript
const authFetch = useAuthFetch();
const { logout } = useAuth();

const loadData = async () => {
  const response = await authFetch('/api/data');
  
  if (response.status === 401) {
    // Token expired or invalid
    alert('Session expired. Please log in again.');
    await logout();
    navigate('/login');
    return;
  }
  
  if (response.ok) {
    const data = await response.json();
    // process data
  }
};
```

### Handle Network Errors
```typescript
const authFetch = useAuthFetch();

try {
  const response = await authFetch('/api/data');
  // process response
} catch (error) {
  if (error instanceof TypeError) {
    // Network error (offline, CORS, etc.)
    alert('Network error. Please check your connection.');
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

## Testing

### Mock useAuthFetch in Tests
```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useAuthFetch } from '../hooks/useAuthFetch';

jest.mock('../hooks/useAuthFetch');

test('component loads data', async () => {
  const mockAuthFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: 'test' }),
  });
  
  useAuthFetch.mockReturnValue(mockAuthFetch);
  
  // Test your component
});
```

## Performance Tips

### 1. Reuse authFetch Instance
```typescript
// Good - reuse the hook result
const authFetch = useAuthFetch();

useEffect(() => {
  authFetch('/api/data1');
  authFetch('/api/data2');
}, []);
```

### 2. Avoid Creating Multiple Instances
```typescript
// Bad - creates new instance each time
const loadData = () => {
  const authFetch = useAuthFetch(); // Don't do this
  authFetch('/api/data');
};

// Good - create once at component level
const authFetch = useAuthFetch();
const loadData = () => {
  authFetch('/api/data');
};
```

### 3. Use React Query for Caching (Optional)
```typescript
import { useQuery } from 'react-query';
import { useAuthFetch } from '../hooks/useAuthFetch';

function DataComponent() {
  const authFetch = useAuthFetch();
  
  const { data, isLoading } = useQuery('orders', async () => {
    const response = await authFetch('/api/orders');
    return response.json();
  });
  
  if (isLoading) return <div>Loading...</div>;
  return <div>{/* render data */}</div>;
}
```

## Summary

### Key Takeaways
1. **Use `useAuthFetch()` hook** for all API calls
2. **Session fallback** ensures backward compatibility
3. **No breaking changes** - old code still works
4. **Phantom tokens** add security layer automatically
5. **User data loads correctly** with both methods

### Quick Reference
- **Hook**: `useAuthFetch()` - For API calls
- **Context**: `useAuth()` - For user state
- **Headers**: Auto-included via `getAuthHeaders()`
- **Fallback**: Session cookies always work
