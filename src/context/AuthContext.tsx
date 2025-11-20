import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiUrl } from '../config/api';

interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isValidating: boolean;
  token: string | null;
  login: (emailOrPhone: string, password: string) => Promise<User>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthHeaders: () => HeadersInit;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isValidating, setIsValidating] = useState(true);


  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add phantom token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  };

  useEffect(() => {
    const validateSession = async () => {
      try {
        setIsValidating(true);
        
        // Validate with backend using phantom token or session
        const response = await fetch(getApiUrl('/api/auth/validate-session'), {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.valid && data.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          } else {
            setUser(null);
            setToken(null);
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.error('Session validation error:', error);
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, [token]);

  const login = async (emailOrPhone: string, password: string): Promise<User> => {
    const response = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ emailOrPhone, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }

    const data = await response.json();
    const userData: User = { username: data.username, role: data.role };

    // Store phantom token if provided
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
    }

    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const signup = async (username: string, email: string, password: string) => {
    const response = await fetch(getApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Signup failed');
    }

    const data = await response.json();
    const userData: User = { username: data.username, role: data.role };
    
    // Store phantom token if provided
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
    }
    
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isValidating, token, login, signup, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};