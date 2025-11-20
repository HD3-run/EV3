import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Mail, Lock, LogIn, Terminal } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [binaryCode, setBinaryCode] = useState<string>('');
  const [lastAccess, setLastAccess] = useState<string>('--:--:--');

  // Generate animated binary code background
  useEffect(() => {
    const generateBinary = () => {
      const lines = Array.from({ length: 20 }, () =>
        Array.from({ length: 50 }, () => (Math.random() > 0.5 ? '1' : '0')).join('')
      ).join('\n');
      setBinaryCode(lines);
    };
    
    generateBinary();
    const interval = setInterval(generateBinary, 2000);
    return () => clearInterval(interval);
  }, []);

  // Load last access time from localStorage
  useEffect(() => {
    const savedLastAccess = localStorage.getItem('lastLoginTime');
    if (savedLastAccess) {
      const lastAccessDate = new Date(savedLastAccess);
      const now = new Date();
      const timeDiff = now.getTime() - lastAccessDate.getTime();
      
      // Format based on how recent it was
      if (timeDiff < 60000) { // Less than 1 minute
        setLastAccess('Just now');
      } else if (timeDiff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(timeDiff / 60000);
        setLastAccess(`${minutes}m ago`);
      } else if (timeDiff < 86400000) { // Less than 1 day
        const hours = Math.floor(timeDiff / 3600000);
        setLastAccess(`${hours}h ago`);
      } else {
        // Show formatted date and time
        const formatted = lastAccessDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        setLastAccess(formatted);
      }
    }
  }, []);

  // Phone number validation for Indian phone numbers
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Indian phone number patterns:
    // 10 digits: 9876543210
    // 11 digits with country code: 919876543210
    // 12 digits with +91: +919876543210
    // 13 digits with country code: 919876543210 (with extra digit)
    const phoneRegex = /^(?:\+?91)?[6-9]\d{9}$/;

    return phoneRegex.test(digitsOnly) && digitsOnly.length >= 10 && digitsOnly.length <= 13;
  };

  const isEmail = (input: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate input format
    if (!isEmail(emailOrPhone) && !validatePhoneNumber(emailOrPhone)) {
      setError('Please enter a valid email address or Indian phone number');
      setIsLoading(false);
      return;
    }

    try {
      const userData = await login(emailOrPhone, password);

      // Save login time to localStorage
      localStorage.setItem('lastLoginTime', new Date().toISOString());

      // Add a small delay to ensure state updates are processed
      setTimeout(() => {
        // Redirect based on user role after state update
        if (userData?.role === 'admin') {
          setLocation('/dashboard');
        } else {
          setLocation('/employee-dashboard');
        }
      }, 100);

    } catch (err: any) {
      setError(err.message || 'Invalid email/phone or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden px-4 py-12">
      {/* Animated Binary Code Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <pre className="text-green-400 font-mono text-xs leading-tight p-4 whitespace-pre-wrap">
          {binaryCode}
        </pre>
      </div>

      {/* Terminal Window */}
      <div className="w-full max-w-md relative z-10">
        {/* Terminal Header */}
        <div className="bg-gray-900 border-t-2 border-x-2 border-green-500 rounded-t-lg px-4 py-2 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex-1 flex items-center gap-2 ml-4">
            <Terminal className="h-4 w-4 text-green-400" />
            <span className="text-green-400 font-mono text-sm">login@Ecomमित्र:~$</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="bg-black border-2 border-green-500 border-t-0 rounded-b-lg p-6 font-mono">
          {/* Welcome Message */}
          <div className="mb-6 space-y-2">
            <p className="text-green-400 text-sm">$ Ecomमित्र.login.init()</p>
            <p className="text-green-400 text-sm">$ Welcome to Ecomमित्र..</p>
            <p className="text-green-400 text-sm">$ Login and continue your mission..</p>
            <div className="h-px bg-green-500/30 my-4"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email/Phone Field */}
            <div>
              <label htmlFor="emailOrPhone" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Email or Phone:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type="text"
                  id="emailOrPhone"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border-2 border-green-500/50 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="user@email.com | 94320915106"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Password:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="block w-full pl-10 pr-10 py-2.5 bg-gray-900 border-2 border-green-500/50 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-500 hover:text-green-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-green-500/60 font-mono">
                [INFO] Format: 8+ chars, A-Z, a-z, 0-9, special chars
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border-2 border-red-500/50 rounded p-3">
                <p className="text-red-400 text-sm font-mono">
                  <span className="text-red-500">[ERROR]</span> {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded border-2 border-green-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-mono text-sm shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                  <span>$ authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>$ login</span>
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 pt-4 border-t border-green-500/30 text-center">
            <p className="text-green-500/60 text-xs font-mono">
              <span className="text-green-500">$</span> New user?{' '}
              <a 
                href="/signup" 
                className="text-green-400 hover:text-green-300 underline transition-colors"
              >
                signup.init()
              </a>
            </p>
          </div>

          {/* Terminal Footer */}
          <div className="mt-6 pt-4 border-t border-green-500/30">
            <p className="text-green-500/40 text-xs font-mono">
              <span className="text-green-500">$</span> System Status: <span className="text-green-400">ONLINE</span>
            </p>
            <p className="text-green-500/40 text-xs font-mono mt-1">
              <span className="text-green-500">$</span> Last Access: <span className="text-green-400">{lastAccess}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}