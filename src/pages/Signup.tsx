import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { getApiUrl } from '../config/api';
import { Eye, EyeOff, Mail, Lock, User, Building2, Phone, UserPlus, Terminal } from 'lucide-react';

export default function Signup() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [binaryCode, setBinaryCode] = useState<string>('');

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

  // Phone number validation for Indian phone numbers (exactly 10 digits)
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Indian phone number: exactly 10 digits starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;

    return phoneRegex.test(digitsOnly) && digitsOnly.length === 10;
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits and limit to 10 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(digitsOnly);
    
    // Real-time validation
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      setPhoneError('Please enter a valid 10-digit Indian phone number');
    } else if (digitsOnly.length === 10 && !validatePhoneNumber(digitsOnly)) {
      setPhoneError('Phone number must start with 6, 7, 8, or 9');
    } else {
      setPhoneError('');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhoneError('');
    setIsLoading(true);

    // Validate phone number before submission
    if (!validatePhoneNumber(phoneNumber)) {
      if (phoneNumber.length < 10) {
        setPhoneError('Please enter a valid 10-digit Indian phone number');
      } else {
        setPhoneError('Phone number must start with 6, 7, 8, or 9');
      }
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, phoneNumber, businessName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }

      // If signup is successful, redirect to login page
      alert('Registration successful! Please log in with your credentials.');
      setLocation('/login');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
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
            <span className="text-green-400 font-mono text-sm">signup@Ecomमित्र:~$</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="bg-black border-2 border-green-500 border-t-0 rounded-b-lg p-6 font-mono max-h-[90vh] overflow-y-auto terminal-scrollbar">
          {/* Welcome Message */}
          <div className="mb-6 space-y-2">
            <p className="text-green-400 text-sm">$ Ecomमित्र.signup.init()</p>
            <p className="text-green-400 text-sm">$ Join the Legion!</p>
            <p className="text-green-400 text-sm">$ Start managing your e-commerce business today!</p>
            <div className="h-px bg-green-500/30 my-4"></div>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Business Name Field */}
            <div>
              <label htmlFor="businessName" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Business Name:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type="text"
                  id="businessName"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border-2 border-green-500/50 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Your Business Name"
                />
              </div>
            </div>

            {/* Full Name Field */}
            <div>
              <label htmlFor="username" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Full Name:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type="text"
                  id="username"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border-2 border-green-500/50 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Your Full Name"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Email:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type="email"
                  id="email"
                  className="block w-full pl-10 pr-3 py-2.5 bg-gray-900 border-2 border-green-500/50 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Phone Number Field */}
            <div>
              <label htmlFor="phoneNumber" className="block text-green-400 text-sm mb-2">
                <span className="text-green-500">$</span> Phone Number:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-green-500" />
                </div>
                <input
                  type="tel"
                  id="phoneNumber"
                  className={`block w-full pl-10 pr-3 py-2.5 bg-gray-900 border-2 rounded text-green-400 placeholder-green-500/50 focus:outline-none focus:ring-2 transition-all font-mono text-sm ${
                    phoneError ? 'border-red-500 focus:ring-red-500/20' : 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="9876543210"
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  title="Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9"
                />
              </div>
              {phoneError && (
                <p className="mt-2 text-sm text-red-400 font-mono">
                  <span className="text-red-500">[ERROR]</span> {phoneError}
                </p>
              )}
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
              {/* Password Requirements - Terminal Style */}
              <div className="mt-2 text-xs text-green-500/60 bg-gray-900/80 border border-green-500/30 rounded p-3 font-mono">
                <p className="text-green-400 mb-2">
                  <span className="text-green-500">[INFO]</span> Password requirements:
                </p>
                <ul className="list-none space-y-1 text-green-500/70">
                  <li><span className="text-green-500">•</span> Minimum 8 characters</li>
                  <li><span className="text-green-500">•</span> At least 1 uppercase letter (A-Z)</li>
                  <li><span className="text-green-500">•</span> At least 1 lowercase letter (a-z)</li>
                  <li><span className="text-green-500">•</span> At least 1 number (0-9)</li>
                  <li><span className="text-green-500">•</span> At least 1 special character (!@#$%^&*)</li>
                </ul>
              </div>
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
                  <span>$ creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>$ signup</span>
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-4 border-t border-green-500/30 text-center">
            <p className="text-green-500/60 text-xs font-mono">
              <span className="text-green-500">$</span> Already have an account?{' '}
              <a 
                href="/login" 
                className="text-green-400 hover:text-green-300 underline transition-colors"
              >
                login.init()
              </a>
            </p>
          </div>

          {/* Terminal Footer */}
          <div className="mt-6 pt-4 border-t border-green-500/30">
            <p className="text-green-500/40 text-xs font-mono">
              <span className="text-green-500">$</span> System Status: <span className="text-green-400">ONLINE</span>
            </p>
            <p className="text-green-500/40 text-xs font-mono mt-1">
              <span className="text-green-500">$</span> Registration: <span className="text-green-400">OPEN</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}