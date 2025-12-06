import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

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
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${level <= strength.score ? strength.color : 'bg-gray-700'}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">{strength.label}</p>
    </div>
  );
});

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    const hash = location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
    } else {
      toast.error('Invalid reset link. Please try again.');
      navigate('/auth');
    }
  }, [location, navigate]);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(pass)) return 'Password must contain at least one number.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPasswordError('');
    setConfirmPasswordError('');

    const passError = validatePassword(password);
    if (passError) {
      setPasswordError(passError);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password reset successful!');
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToAuth = () => navigate('/auth');

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card className="bg-gray-800 border-gray-700 shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <OptimizedImage
                src="https://placehold.co/64x64?text=Logo"
                fallbackSrc="https://placehold.co/64x64?text=Fallback"
                alt="studdyhub AI Logo"
                className="h-16 w-16 rounded-full"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-gray-100">Reset Password</CardTitle>
            <CardDescription className="text-center text-gray-400">Enter a new secure password for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-300">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 pr-10 h-12 rounded-lg border transition-all bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${passwordError ? 'border-red-500' : 'border-gray-600'}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {passwordError}</p>}
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
                    className={`pl-10 pr-10 h-12 rounded-lg border transition-all bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${confirmPasswordError ? 'border-red-500' : 'border-gray-600'}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPasswordError && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="h-3 w-3" /> {confirmPasswordError}</p>}
                {confirmPassword && !confirmPasswordError && (
                  <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
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