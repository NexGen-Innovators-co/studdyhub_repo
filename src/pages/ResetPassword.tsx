import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

// Optimized image component with lazy loading and fallbacks
const OptimizedImage = React.memo(({ src, alt, className, fallbackSrc }: {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  }, [fallbackSrc, imgSrc]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-full animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
      {hasError && !fallbackSrc && (
        <div className={`${className} bg-gray-800 flex items-center justify-center rounded-full`}>
          <Lock className="h-4 w-4 text-gray-400" />
        </div>
      )}
    </div>
  );
});

// Enhanced loading button component
const LoadingButton = React.memo(({ isLoading, children, className, ...props }: {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <Button
    className={`relative ${className}`}
    disabled={isLoading}
    {...props}
  >
    {isLoading && (
      <Loader2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />
    )}
    <span className={isLoading ? 'opacity-0' : 'opacity-100'}>
      {children}
    </span>
  </Button>
));

// Password strength indicator
const PasswordStrength = React.memo(({ password }: { password: string }) => {
  const strength = React.useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

    return {
      score,
      label: labels[Math.min(score, 4)],
      color: colors[Math.min(score, 4)]
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${level <= strength.score ? strength.color : 'bg-gray-700'
              }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">{strength.label}</p>
    </div>
  );
});

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Extract token and type from URL hash or search params
  const getTokenFromUrl = useCallback(() => {
    // First check the hash (common for auth redirects)
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    // If not in hash, check search params
    if (!accessToken) {
      const searchParams = new URLSearchParams(location.search);
      return {
        access_token: searchParams.get('access_token'),
        refresh_token: searchParams.get('refresh_token'),
        type: searchParams.get('type')
      };
    }

    return { access_token: accessToken, refresh_token: refreshToken, type };
  }, [location.hash, location.search]);

  // Validate token and set session
  useEffect(() => {
    const validateToken = async () => {
      setIsCheckingToken(true);
      const { access_token, refresh_token, type } = getTokenFromUrl();

      if (!access_token || type !== 'recovery') {
        setIsValidToken(false);
        setIsCheckingToken(false);
        toast.error('Invalid or expired reset link. Please request a new one.');
        return;
      }

      try {
        // Set the session with the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || '',
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          setIsValidToken(true);
          toast.success('Reset link verified! You can now set your new password.');
        } else {
          throw new Error('No session created');
        }
      } catch (error: any) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
        toast.error('Invalid or expired reset link. Please request a new one.');
      } finally {
        setIsCheckingToken(false);
      }
    };

    validateToken();
  }, [getTokenFromUrl]);

  // Password validation
  const validatePassword = useCallback((pass: string) => {
    if (!pass) {
      setPasswordError('');
      return true;
    }

    if (pass.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return false;
    }

    if (pass.length > 128) {
      setPasswordError('Password is too long (maximum 128 characters)');
      return false;
    }

    setPasswordError('');
    return true;
  }, []);

  // Confirm password validation
  const validateConfirmPassword = useCallback((confirmPass: string) => {
    if (!confirmPass) {
      setConfirmPasswordError('');
      return true;
    }

    if (confirmPass !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }

    setConfirmPasswordError('');
    return true;
  }, [password]);

  // Debounced validation
  useEffect(() => {
    const timeoutId = setTimeout(() => validatePassword(password), 300);
    return () => clearTimeout(timeoutId);
  }, [password, validatePassword]);

  useEffect(() => {
    const timeoutId = setTimeout(() => validateConfirmPassword(confirmPassword), 300);
    return () => clearTimeout(timeoutId);
  }, [confirmPassword, validateConfirmPassword]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword(password) || !validateConfirmPassword(confirmPassword)) {
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully! You can now sign in with your new password.');
      
      // Sign out to clear the recovery session
      await supabase.auth.signOut();
      
      // Redirect to auth page with sign in tab
      navigate('/auth', { replace: true });
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      if (error.message.includes('same as the old password')) {
        toast.error('New password must be different from your current password.');
      } else if (error.message.includes('weak password')) {
        toast.error('Please choose a stronger password.');
      } else {
        toast.error(error.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToAuth = () => {
    navigate('/auth', { replace: true });
  };

  // Show loading state while checking token
  if (isCheckingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 bg-[url('/herobackgroundimg.png')] bg-cover bg-center bg-fixed
        before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-gray-950/70 before:to-gray-950/90 before:z-0">
        <div className="relative z-10 text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
          <p className="text-gray-300">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Show error state if token is invalid
  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex flex-col font-inter relative overflow-hidden
        bg-gray-950 bg-[url('/herobackgroundimg.png')] bg-cover bg-center bg-fixed
        before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-gray-950/70 before:to-gray-950/90 before:z-0 text-white">
        
        <div className="flex flex-grow items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
          <Card className="w-full max-w-md mx-auto bg-gray-900/95 backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden border border-red-700/50">
            <CardHeader className="text-center space-y-4 p-6 sm:p-8 pb-4">
              <div className="flex items-center justify-center">
                <div className="bg-red-500/10 p-3 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                  Invalid Reset Link
                </CardTitle>
                <CardDescription className="text-sm sm:text-base text-gray-400 mt-2">
                  This password reset link is invalid or has expired.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-4">
              <div className="text-center text-gray-300 space-y-2">
                <p>The password reset link you clicked is either:</p>
                <ul className="text-sm space-y-1 text-left list-disc list-inside text-gray-400">
                  <li>Already used</li>
                  <li>Expired (links expire after 1 hour)</li>
                  <li>Invalid or corrupted</li>
                </ul>
              </div>

              <Button
                onClick={handleBackToAuth}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] h-12"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>

              <p className="text-xs text-gray-500 text-center">
                You can request a new password reset link from the sign in page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show reset password form if token is valid
  return (
    <div className="min-h-screen flex flex-col font-inter relative overflow-hidden
      bg-gray-950 bg-[url('/herobackgroundimg.png')] bg-cover bg-center bg-fixed
      before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-gray-950/70 before:to-gray-950/90 before:z-0 text-white">
      
      <div className="flex flex-grow items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <Card className="w-full max-w-md mx-auto bg-gray-900/95 backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden border border-gray-700/50 transition-all duration-300 hover:shadow-3xl">
          <CardHeader className="text-center space-y-4 p-6 sm:p-8 pb-4 bg-gradient-to-b from-gray-900/95 to-gray-900/90">
            <div className="flex items-center justify-center gap-3">
              <OptimizedImage
                src="/siteimage.png"
                alt="studdyhub AI Logo"
                className="h-9 w-9 sm:h-11 sm:w-11 object-contain"
                fallbackSrc="/favicon.ico"
              />
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                studdyhub AI
              </h1>
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                Reset Your Password
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-400 mt-2">
                Enter your new password below to secure your account.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-gray-300">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${passwordError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                      }`}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-300">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${confirmPasswordError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                      }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPasswordError && <p className="text-xs text-red-400">{confirmPasswordError}</p>}
                {confirmPassword && !confirmPasswordError && (
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Passwords match
                  </div>
                )}
              </div>

              <LoadingButton
                type="submit"
                isLoading={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] h-12"
              >
                Update Password
              </LoadingButton>
            </form>

            <div className="text-center text-sm text-gray-400 mt-6">
              <button
                onClick={handleBackToAuth}
                className="text-blue-400 hover:underline focus:outline-none transition-colors inline-flex items-center gap-2"
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center mt-6 space-y-2">
              <p>
                By resetting your password, you agree to studdyhub AI's{' '}
                <a href="/terms-of-service" className="text-blue-400 hover:underline transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy-policy" className="text-blue-400 hover:underline transition-colors">
                  Privacy Policy
                </a>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;