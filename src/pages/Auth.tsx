import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, XCircle, RefreshCw, Clock, Ticket } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

// List of common disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com'
];

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
          <User className="h-4 w-4 text-gray-400" />
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
  const strength = useMemo(() => {
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

// Resend verification component
const ResendVerification = React.memo(({ email, onSuccess }: { email: string; onSuccess?: () => void }) => {
  const [isResending, setIsResending] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend cooldown (60 seconds)
  useEffect(() => {
    if (lastSentTime) {
      const interval = setInterval(() => {
        const timePassed = Math.floor((Date.now() - lastSentTime) / 1000);
        const timeLeft = Math.max(60 - timePassed, 0);
        setCountdown(timeLeft);

        if (timeLeft === 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [lastSentTime]);

  const handleResend = async () => {
    if (!email || isResending || countdown > 0) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        if (error.message.includes('already confirmed')) {
          toast.success('Your email is already verified! You can now sign in.');
        } else if (error.message.includes('rate limit')) {
          toast.error('Please wait before requesting another confirmation email.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Confirmation email sent! Please check your inbox and spam folder.');
        setLastSentTime(Date.now());
        setCountdown(60);
        onSuccess?.();
      }
    } catch (error) {
      toast.error('Failed to resend confirmation email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-4 w-4 text-blue-400" />
        <p className="text-sm text-blue-300 font-medium">Email Verification Required</p>
      </div>
      <p className="text-xs text-blue-200/80 mb-3">
        Didn't receive the confirmation email? Check your spam folder or request a new one.
      </p>
      <LoadingButton
        onClick={handleResend}
        isLoading={isResending}
        disabled={countdown > 0}
        variant="outline"
        size="sm"
        className="w-full bg-blue-800/50 border-blue-600 text-blue-200 hover:bg-blue-700/50 hover:text-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {countdown > 0 ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Resend in {countdown}s
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Resend Confirmation
          </div>
        )}
      </LoadingButton>
    </div>
  );
});

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentTab, setCurrentTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const navigate = useNavigate();

  // Enhanced email validation
  const validateEmail = useCallback((email: string) => {
    if (!email) {
      setEmailError('');
      return true;
    }

    // Basic format check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    // Check for common typos in domain
    const commonTypos = [
      { wrong: 'gamil.com', correct: 'gmail.com' },
      { wrong: 'hotnail.com', correct: 'hotmail.com' },
      { wrong: 'yaho.com', correct: 'yahoo.com' },
    ];

    const domain = email.split('@')[1].toLowerCase();
    const typo = commonTypos.find(t => t.wrong === domain);
    if (typo) {
      setEmailError(`Did you mean ${typo.correct}?`);
      return false;
    }

    // Check for disposable email domains
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      setEmailError('Disposable email addresses are not allowed');
      return false;
    }

    // Check for valid domain length
    if (domain.length > 255 || email.split('@')[0].length > 64) {
      setEmailError('Email address is too long');
      return false;
    }

    setEmailError('');
    return true;
  }, []);

  // Debounced name checking
  const checkFullNameExists = useCallback(async (name: string) => {
    if (!name.trim() || currentTab !== 'signup') return false;

    setIsCheckingName(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('full_name', name.trim())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const exists = data !== null;
      setNameError(exists ? 'This name is already taken' : '');
      return exists;
    } catch (error) {
      //console.error('Error checking full name existence:', error);
      setNameError('Error checking name availability');
      return true;
    } finally {
      setIsCheckingName(false);
    }
  }, [currentTab]);

  // Debounced handlers
  useEffect(() => {
    const timeoutId = setTimeout(() => validateEmail(email), 500);
    return () => clearTimeout(timeoutId);
  }, [email, validateEmail]);

  useEffect(() => {
    if (currentTab === 'signup' && fullName.trim()) {
      const timeoutId = setTimeout(() => checkFullNameExists(fullName), 800);
      return () => clearTimeout(timeoutId);
    }
  }, [fullName, checkFullNameExists, currentTab]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard', { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  // Clear form when switching tabs
  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab as 'signin' | 'signup' | 'forgot');
    setEmail('');
    setPassword('');
    setFullName('');
    setPromoCode('');
    setEmailError('');
    setNameError('');
    setShowPassword(false);
    setShowResendVerification(false);
    setPendingVerificationEmail('');
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email) || !fullName.trim() || nameError) {
      if (!fullName.trim()) toast.error('Please enter your full name.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const nameExists = await checkFullNameExists(fullName.trim());
      if (nameExists) {
        toast.error('This full name is already taken. Please choose a different one.');
        return;
      }

      // Check for referral code in URL
      const urlParams = new URLSearchParams(window.location.search);
      const referralCode = urlParams.get('ref');

      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName.trim(),
            referral_code_used: referralCode || null,
            promo_code: promoCode ? promoCode.trim().toUpperCase() : null,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
          handleTabChange('signin');
          setEmail(email);
        } else {
          toast.error(error.message);
        }
      } else {
        // Process referral if code was provided and signup successful
        if (referralCode && data.user) {
          try {
            const { error: refError } = await supabase.rpc('process_referral_reward', {
              p_referee_id: data.user.id,
              p_referral_code: referralCode.toUpperCase()
            });
            if (!refError) {
              toast.success('Referral bonus applied! You received 10 extra AI credits.');
            }
          } catch (refErr) {
            //console.log('Referral processing will complete after email verification');
          }
        }

        // Process Code Night Promo (Handled by DB trigger on signup)
        if (promoCode && promoCode.trim().toUpperCase() === 'CODENIGHT2026') {
             toast.success('Code Night Offer Applied! You will have 1 month of Free Premium access after verification.');
        }

        toast.success('Account created! Please check your email for a confirmation link.');
        setPendingVerificationEmail(email.toLowerCase().trim());
        setShowResendVerification(true);
      }
    } catch (error) {
      toast.error('An unexpected error occurred during sign-up.');
    } finally {
      setIsLoading(false);
    }
  };

  // In Auth.tsx, update handleSignIn function:

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please check your email and confirm your account before signing in.');
          setPendingVerificationEmail(email.toLowerCase().trim());
          setShowResendVerification(true);
        } else {
          toast.error(error.message);
        }
      } else {
        // Process Code Night Promo
        if (promoCode && data.user) {
           try {
              const { error: promoError } = await supabase.rpc('apply_code_night_promo', {
                p_user_id: data.user.id,
                p_promo_code: promoCode.trim()
              });
              
              if (!promoError) {
                toast.success('Code Night Offer Applied! You have 1 month of Free Premium access.');
              }
           } catch (err) {
             console.error('Error applying promo:', err);
           }
        }
        // toast.success('Welcome back!');
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error('An unexpected error occurred during sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset email sent! Please check your inbox.');
        handleTabChange('signin');
      }
    } catch (error) {
      toast.error('An unexpected error occurred during password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen automatically
      toast.success('Redirecting to Google...');
    } catch (error: any) {
      //console.error('Google sign-in error:', error);
      toast.error(error.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-inter relative overflow-hidden
      bg-gray-950 bg-[url('/herobackgroundimg.png')] bg-cover bg-center bg-fixed
      before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-gray-950/70 before:to-gray-950/90 before:z-0 text-white">

      {/* Main Content Area */}
      <div className="flex flex-grow flex-col lg:flex-row items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">

        {/* Left Column - Auth Form */}
        <div className="flex-1 flex items-center justify-center w-full lg:w-1/2 p-4">
          <Card className="w-full max-w-md mx-auto bg-gray-900/95 backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden border border-gray-700/50 transition-all duration-300 hover:shadow-3xl">
            <CardHeader className="text-center space-y-4 p-6 sm:p-8 pb-4 bg-gradient-to-b from-gray-900/95 to-gray-900/90">
              <div className="flex items-center justify-center gap-3">
                <OptimizedImage
                  src="/siteimage.png"
                  alt="studdyhub AI Logo"
                  className="h-9 w-9 sm:h-11 sm:w-11 object-contain"
                  fallbackSrc="/favicon.ico"
                />
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">
                  studdyhub AI
                </h1>
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                  {currentTab === 'signin' ? 'Welcome Back!' : currentTab === 'signup' ? 'Join studdyhub AI' : 'Reset Password'}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base text-gray-400 mt-2">
                  {currentTab === 'signin'
                    ? 'Sign in to continue your learning journey.'
                    : currentTab === 'signup'
                      ? 'Create an account to start your learning journey.'
                      : 'Reset your password to regain access.'
                  }
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full h-full grid-cols-3 bg-gray-800/50">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  <TabsTrigger value="forgot">Forgot Password</TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      className="w-full h-12 rounded-lg border border-gray-600 bg-gray-700/50 backdrop-blur-sm text-gray-100 hover:bg-gray-600/50 transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]"
                      disabled={isLoading}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.0003 4.40002C13.6003 4.40002 14.9603 4.96002 16.0003 5.92002L19.0403 2.96002C17.2003 1.28002 14.8003 0.400024 12.0003 0.400024C7.28033 0.400024 3.20033 3.04002 1.28033 7.04002L5.28033 10.0001C6.24033 7.52002 8.96033 5.92002 12.0003 5.92002V4.40002Z" fill="#EA4335" />
                        <path d="M23.6003 12.0001C23.6003 11.2001 23.5203 10.4001 23.3603 9.60009H12.0003V14.4001H18.8003C18.4803 16.0001 17.6003 17.2001 16.4003 18.0001V21.4401H20.8003C23.2003 19.2001 23.6003 15.8401 23.6003 12.0001Z" fill="#4285F4" />
                        <path d="M12.0003 23.6001C14.8003 23.6001 17.2003 22.7201 19.0403 21.4401L16.0003 18.0001C14.9603 18.7201 13.6003 19.2001 12.0003 19.2001C8.96033 19.2001 6.24033 17.6001 5.28033 15.1201L1.28033 18.0801C3.20033 22.0801 7.28033 24.7201 12.0003 24.7201V23.6001Z" fill="#34A853" />
                        <path d="M0.400326 12.0001C0.400326 11.2001 0.480326 10.4001 0.640326 9.60009L4.64033 6.64009C4.32033 7.28009 4.08033 7.92009 3.92033 8.64009H0.400326V12.0001Z" fill="#FBBC04" />
                      </svg>
                      Continue with Google
                    </Button>
                  </div>

                  <div className="relative flex items-center justify-center my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative z-10 bg-gray-900 px-4 text-sm text-gray-400">
                      or
                    </div>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-sm font-medium text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${emailError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                            }`}
                          required
                        />
                        {email && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {emailError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="signin-password" className="text-sm font-medium text-gray-300">Password</Label>
                        <button
                          type="button"
                          onClick={() => handleTabChange('forgot')}
                          className="text-sm text-blue-400 hover:underline transition-colors"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800/50 backdrop-blur-sm text-gray-100 transition-all duration-200"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="signin-promo" className="text-sm font-medium text-gray-300">Promo Code (Optional)</Label>
                        <div className="relative">
                          <Ticket className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            id="signin-promo"
                            type="text"
                            placeholder="e.g. CODENIGHT2026"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800/50 backdrop-blur-sm text-gray-100 transition-all duration-200"
                          />
                        </div>
                    </div>

                    <LoadingButton
                      type="submit"
                      isLoading={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] h-12"
                    >
                      Sign In
                    </LoadingButton>
                  </form>

                  {/* Show resend verification for sign in if needed */}
                  {showResendVerification && pendingVerificationEmail && currentTab === 'signin' && (
                    <ResendVerification
                      email={pendingVerificationEmail}
                      onSuccess={() => setShowResendVerification(false)}
                    />
                  )}

                  <div className="text-center text-sm text-gray-400 mt-4">
                    Don't have an account?{' '}
                    <button
                      onClick={() => handleTabChange('signup')}
                      className="text-blue-400 hover:underline focus:outline-none transition-colors"
                      type="button"
                    >
                      Sign Up Now
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="signup" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      className="w-full h-12 rounded-lg border border-gray-600 bg-gray-700/50 backdrop-blur-sm text-gray-100 hover:bg-gray-600/50 transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]"
                      disabled={isLoading}
                      type="button"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.0003 4.40002C13.6003 4.40002 14.9603 4.96002 16.0003 5.92002L19.0403 2.96002C17.2003 1.28002 14.8003 0.400024 12.0003 0.400024C7.28033 0.400024 3.20033 3.04002 1.28033 7.04002L5.28033 10.0001C6.24033 7.52002 8.96033 5.92002 12.0003 5.92002V4.40002Z" fill="#EA4335" />
                        <path d="M23.6003 12.0001C23.6003 11.2001 23.5203 10.4001 23.3603 9.60009H12.0003V14.4001H18.8003C18.4803 16.0001 17.6003 17.2001 16.4003 18.0001V21.4401H20.8003C23.2003 19.2001 23.6003 15.8401 23.6003 12.0001Z" fill="#4285F4" />
                        <path d="M12.0003 23.6001C14.8003 23.6001 17.2003 22.7201 19.0403 21.4401L16.0003 18.0001C14.9603 18.7201 13.6003 19.2001 12.0003 19.2001C8.96033 19.2001 6.24033 17.6001 5.28033 15.1201L1.28033 18.0801C3.20033 22.0801 7.28033 24.7201 12.0003 24.7201V23.6001Z" fill="#34A853" />
                        <path d="M0.400326 12.0001C0.400326 11.2001 0.480326 10.4001 0.640326 9.60009L4.64033 6.64009C4.32033 7.28009 4.08033 7.92009 3.92033 8.64009H0.400326V12.0001Z" fill="#FBBC04" />
                      </svg>
                      Sign up with Google
                    </Button>
                  </div>

                  <div className="relative flex items-center justify-center my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative z-10 bg-gray-900 px-4 text-sm text-gray-400">
                      or
                    </div>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium text-gray-300">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${nameError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                            }`}
                          required
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          {isCheckingName ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : fullName && !nameError ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : nameError ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : null}
                        </div>
                      </div>
                      {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${emailError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                            }`}
                          required
                        />
                        {email && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {emailError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium text-gray-300">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800/50 backdrop-blur-sm text-gray-100 transition-all duration-200"
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
                      <PasswordStrength password={password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-promo" className="text-sm font-medium text-gray-300">Promo Code (Optional)</Label>
                      <div className="relative">
                        <Ticket className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="signup-promo"
                          type="text"
                          placeholder="e.g. CODENIGHT2026"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          className="pl-10 h-12 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 bg-gray-800/50 backdrop-blur-sm text-gray-100 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <LoadingButton
                      type="submit"
                      isLoading={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] h-12"
                    >
                      Create Account
                    </LoadingButton>
                  </form>

                  {/* Show resend verification for sign up if needed */}
                  {showResendVerification && pendingVerificationEmail && currentTab === 'signup' && (
                    <ResendVerification
                      email={pendingVerificationEmail}
                      onSuccess={() => setShowResendVerification(false)}
                    />
                  )}

                  <div className="text-center text-sm text-gray-400 mt-4">
                    Already have an account?{' '}
                    <button
                      onClick={() => handleTabChange('signin')}
                      className="text-blue-400 hover:underline focus:outline-none transition-colors"
                      type="button"
                    >
                      Sign In
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="forgot" className="space-y-6 mt-6">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`pl-10 pr-10 h-12 rounded-lg border transition-all duration-200 bg-gray-800/50 backdrop-blur-sm text-gray-100 focus:ring-2 focus:ring-blue-500/50 ${emailError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
                            }`}
                          required
                        />
                        {email && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {emailError ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                      {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                    </div>

                    <LoadingButton
                      type="submit"
                      isLoading={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-[1.02] h-12"
                    >
                      Send Reset Link
                    </LoadingButton>
                  </form>

                  <div className="text-center text-sm text-gray-400 mt-4">
                    Back to{' '}
                    <button
                      onClick={() => handleTabChange('signin')}
                      className="text-blue-400 hover:underline focus:outline-none transition-colors"
                      type="button"
                    >
                      Sign In
                    </button>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="text-xs text-gray-500 text-center mt-6 space-y-2">
                <p>
                  By continuing, you agree to Supabase's{' '}
                  <a href="/terms-of-service" className="text-blue-400 hover:underline transition-colors">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy-policy" className="text-blue-400 hover:underline transition-colors">
                    Privacy Policy
                  </a>.
                </p>
                <p>and to receive periodic emails with updates.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Testimonial Section */}
        <div className="flex-1 hidden lg:flex items-center justify-center p-8">
          <div className="max-w-xl text-center lg:text-left space-y-6 animate-fade-in">
            <blockquote className={`text-3xl font-semibold leading-relaxed text-gray-200 before:content-['"'] before:text-5xl before:text-gray-600 before:mr-2 before:align-top after:content-['"'] after:text-5xl after:text-gray-600 after:ml-2 after:align-bottom`}>
              <p>studdyhub AI has changed my study routine! The ability to automatically summarize lectures and generate notes saves me hours every week. It's like having a personal study assistant that truly understands my needs as a student.</p>
            </blockquote>
            <div className="flex items-center justify-center lg:justify-start gap-3 mt-6">
              <OptimizedImage
                src="/founder.jpg"
                alt="Founder of studdyhub AI"
                className="h-20 w-20 rounded-full object-cover border-2 border-gray-600"
                fallbackSrc="/default-avatar.png"
              />
              <span className="text-lg font-medium text-gray-300">A dedicated student & founder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;