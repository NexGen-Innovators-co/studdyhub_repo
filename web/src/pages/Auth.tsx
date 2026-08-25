import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../modules/ui/components/button';
import { Input } from '../modules/ui/components/input';
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, XCircle, RefreshCw, Clock, Ticket, BookOpen, FileText, Play, TrendingUp, Check, Sparkles } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { BrandedLoader } from '../modules/ui/components/brandedLoader';

const DISPOSABLE_EMAIL_DOMAINS = ['mailinator.com','tempmail.com','10minutemail.com','guerrillamail.com','sharklasers.com'];

// Module-level cache for already-loaded image URLs
const loadedImageCache = new Set<string>();

// ─── Sub-components ────────────────────────────────────────────────────────────

const OptimizedImage = React.memo(({ src, alt, className, fallbackSrc }: {
  src: string; alt: string; className?: string; fallbackSrc?: string;
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(!loadedImageCache.has(src));
  const [hasError, setHasError] = useState(false);

  // Sync internal state when src prop changes
  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
    setIsLoading(!loadedImageCache.has(src));
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>}
      <img src={imgSrc} alt={alt} className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => { setIsLoading(false); setHasError(false); loadedImageCache.add(imgSrc); }}
        onError={() => { setIsLoading(false); setHasError(true); if (fallbackSrc && imgSrc !== fallbackSrc) setImgSrc(fallbackSrc); }}
        loading="eager" />
      {hasError && !fallbackSrc && <div className={`${className} bg-slate-200 dark:bg-slate-800 flex items-center justify-center rounded-full`}><User className="h-4 w-4 text-slate-400" /></div>}
    </div>
  );
});

const STATIC_TESTIMONIALS = [
  {
    name: "Doris",
    role: "SHS student",
    content: "StuddyHub AI has completely revolutionized how I study. The AI chat is incredibly helpful, and the document analysis saves me so much time!",
    verified: true,
    imageUrl: "/testimonial1.jpg"
  },
  {
    name: "Isabel",
    role: "Computer Science student at UMaT",
    content: "The voice recording feature with AI transcription is a game-changer for my research interviews. Absolutely incredible!",
    verified: true,
    imageUrl: '/testimonial3.jpg'
  },
  {
    name: "Dr. Effah Emmanuel",
    role: "Computer Science lecturer at UMaT",
    content: "Finally, an AI tool that actually understands my learning style. My productivity has increased by 300%!",
    verified: true,
    imageUrl: '/testimonial2.jpg'
  },
];

const LoadingButton = React.memo(({ isLoading, children, className, ...props }: {
  isLoading: boolean; children: React.ReactNode; className?: string; [key: string]: any;
}) => (
  <Button className={`relative ${className}`} disabled={isLoading} {...props}>
    {isLoading && <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 animate-spin" />}
    <span className={isLoading ? 'opacity-0' : 'opacity-100'}>{children}</span>
  </Button>
));

const PasswordStrength = React.memo(({ password }: { password: string }) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const labels = ['Very Weak','Weak','Fair','Good','Strong'];
    const colors = ['bg-red-500','bg-orange-500','bg-yellow-500','bg-blue-500','bg-emerald-500'];
    return { score, label: labels[Math.min(score,4)], color: colors[Math.min(score,4)] };
  }, [password]);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(l => (
          <div key={l} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${l <= strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{strength.label}</p>
    </div>
  );
});

const ResendVerification = React.memo(({ email, onSuccess }: { email: string; onSuccess?: () => void }) => {
  const [isResending, setIsResending] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!lastSentTime) return;
    const iv = setInterval(() => {
      const left = Math.max(60 - Math.floor((Date.now() - lastSentTime) / 1000), 0);
      setCountdown(left);
      if (left === 0) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, [lastSentTime]);
  const handleResend = async () => {
    if (!email || isResending || countdown > 0) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.toLowerCase().trim(), options: { emailRedirectTo: `${window.location.origin}/` } });
      if (error) {
        if (error.message.includes('already confirmed')) toast.success('Your email is already verified! You can now sign in.');
        else if (error.message.includes('rate limit')) toast.error('Please wait before requesting another confirmation email.');
        else toast.error(error.message);
      } else {
        toast.success('Confirmation email sent! Check your inbox and spam folder.');
        setLastSentTime(Date.now()); setCountdown(60); onSuccess?.();
      }
    } catch { toast.error('Failed to resend confirmation email. Please try again.'); }
    finally { setIsResending(false); }
  };
  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl">
      <div className="flex items-center gap-2 mb-1.5">
        <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold">Email Verification Required</p>
      </div>
      <p className="text-xs text-blue-600/80 dark:text-blue-300/70 mb-3">Didn't receive the confirmation email? Check your spam folder or request a new one.</p>
      <LoadingButton onClick={handleResend} isLoading={isResending} disabled={countdown > 0} variant="outline" size="sm"
        className="w-full bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 disabled:opacity-50">
        {countdown > 0
          ? <span className="flex items-center gap-2"><Clock className="h-4 w-4"/>Resend in {countdown}s</span>
          : <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4"/>Resend Confirmation</span>}
      </LoadingButton>
    </div>
  );
});

// ─── Main component ────────────────────────────────────────────────────────────

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentTab, setCurrentTab] = useState<'signin'|'signup'|'forgot'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  // right‑column README/demo and testimonials management
  const [authTestimonials, setAuthTestimonials] = useState<any[]>([]);
  const [authIndex, setAuthIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isFading, setIsFading] = useState(false);
  const [rightView, setRightView] = useState<'testimonials'|'walkthrough'>('testimonials');
  const prevAuthIndexRef = useRef<number>(0);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // switch to walkthrough automatically when testimonials wrap
  useEffect(() => {
    // scroll to top whenever panel view changes
    rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [rightView]);

  const lastWalkthroughRef = useRef<number>(0);

  useEffect(() => {
    if (rightView !== 'testimonials') return;
    if (authTestimonials.length <= 1) { prevAuthIndexRef.current = authIndex; return; }
    const now = Date.now();
    if (now - lastWalkthroughRef.current < 30000) {
      // suppress replay for 30 seconds
      prevAuthIndexRef.current = authIndex;
      return;
    }
    const prev = prevAuthIndexRef.current;
    if (prev === authTestimonials.length - 1 && authIndex === 0) {
      prevAuthIndexRef.current = authIndex;
      const t = setTimeout(() => {
        setRightView('walkthrough');
        lastWalkthroughRef.current = Date.now();
      }, 2000);
      return () => clearTimeout(t);
    }
    prevAuthIndexRef.current = authIndex;
  }, [authIndex, authTestimonials.length, rightView]);
  const navigate = useNavigate();

  // guided walkthrough component displayed as a vertical path of key features
  const Walkthrough = ({ onFinish }: { onFinish?: () => void }) => {
    const steps = [
      { title: 'Create notes', desc: 'Write, categorize, and review your study notes with rich formatting and smart organisation.', Icon: BookOpen, color: 'from-blue-500 to-cyan-400' },
      { title: 'Record lectures', desc: 'Capture audio live and get automatic AI-powered transcriptions in seconds.', Icon: Play, color: 'from-violet-500 to-purple-400' },
      { title: 'Upload documents', desc: 'Import PDFs, slides, and images — AI extracts key points instantly.', Icon: FileText, color: 'from-amber-500 to-orange-400' },
      { title: 'Track progress', desc: 'See your streaks, weekly summaries, and study-time analytics at a glance.', Icon: Clock, color: 'from-emerald-500 to-green-400' },
      { title: 'Get insights', desc: 'Personalised AI study tips and recommendations that adapt to your habits.', Icon: TrendingUp, color: 'from-rose-500 to-pink-400' }
    ];

    const containerRef = useRef<HTMLDivElement>(null);
    const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [displayText, setDisplayText] = useState('');
    const [typingDone, setTypingDone] = useState(false);

    // typing effect for current step description
    const text = steps[currentStep].desc || '';
    useEffect(() => {
      setDisplayText('');
      setTypingDone(false);
      let i = 0;
      let timer: ReturnType<typeof setTimeout>;
      const typeNext = () => {
        if (i < text.length) {
          const ch = text[i];
          if (ch !== undefined) setDisplayText((p) => p + ch);
          i += 1;
          timer = setTimeout(typeNext, 30);
        } else {
          setTypingDone(true);
        }
      };
      typeNext();
      return () => clearTimeout(timer);
    }, [text]);

    // advance to next step after typing and a pause
    useEffect(() => {
      if (!typingDone) return;
      if (currentStep >= steps.length - 1) {
        const t = setTimeout(() => onFinish?.(), 2500);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setCurrentStep((s) => s + 1), 2000);
      return () => clearTimeout(t);
    }, [typingDone, currentStep, steps.length, onFinish]);

    const progress = ((currentStep + (typingDone ? 1 : 0.5)) / steps.length) * 100;

    return (
      <div ref={containerRef} className="text-white max-w-lg relative select-none">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-blue-400/80">Guided tour</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
            What you can do
          </h2>
          <p className="text-sm text-slate-400 mt-1">Everything you need to study smarter — all in one place.</p>
        </div>

        {/* Progress bar */}
        {/* <div className="h-1 w-full rounded-full bg-slate-700/50 mb-10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div> */}

        {/* Steps */}
        <div className="relative">
          {/* Vertical line behind nodes */}
          <div className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-slate-600/60 via-slate-700/40 to-transparent" />

          <div className="space-y-2">
            {steps.map((s, idx) => {
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              const isPending = idx > currentStep;

              return (
                <div
                  key={idx}
                  ref={(el) => (stepRefs.current[idx] = el)}
                  className={`relative flex items-start gap-4 rounded-xl px-3 py-4 transition-all duration-500 ${
                    isActive
                      ? 'bg-white/[0.04] backdrop-blur-sm shadow-lg shadow-blue-500/5 scale-100'
                      : 'scale-[0.97]'
                  }`}
                >
                  {/* Node */}
                  <div className="relative flex-shrink-0 z-10">
                    <div
                      className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-500 ${
                        isCompleted
                          ? 'bg-gradient-to-br from-emerald-500 to-green-400 shadow-lg shadow-emerald-500/25'
                          : isActive
                          ? `bg-gradient-to-br ${s.color} shadow-sm shadow-blue-500/25`
                          : 'bg-slate-800 border border-slate-700/50'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4.5 w-4.5 text-white" />
                      ) : (
                        <s.Icon className={`h-4.5 w-4.5 transition-colors duration-300 ${
                          isActive ? 'text-white' : 'text-slate-500'
                        }`} />
                      )}
                    </div>
                    {/* Glow ring on active */}
                    {/* {isActive && (
                      <div className={`absolute -inset-1 rounded-xl bg-gradient-to-br ${s.color} opacity-20 blur-sm animate-pulse`} />
                    )} */}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 min-w-0 pt-1 transition-opacity duration-500 ${isPending ? 'opacity-35' : 'opacity-100'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`font-semibold text-sm transition-colors duration-300 ${
                        isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        {s.title}
                      </h4>
                      {isCompleted && (
                        <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Done</span>
                      )}
                    </div>
                    {isActive && (
                      <p className="text-sm text-slate-300/90 leading-relaxed">
                        {displayText}
                        {!typingDone && <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse" />}
                      </p>
                    )}
                    {isCompleted && (
                      <p className="text-xs text-slate-500 leading-relaxed truncate">{s.desc}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step counter */}
        <div className="mt-8 flex items-center justify-between text-xs text-slate-500">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= currentStep
                    ? 'w-4 bg-gradient-to-r from-blue-500 to-violet-500'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Testimonials / carousel logic ──────────────────────────────────────

  useEffect(() => {
    // fetch user-approved testimonials and append static fallbacks
    const fetchData = async () => {
      try {
        const { data: rows } = await supabase.rpc('get_approved_testimonials', { p_limit: 10 });
        if (rows && Array.isArray(rows)) {
          const mapped = rows.map((t: any) => ({
            name: t.author_name || 'Anonymous',
            role: t.author_role || '',
            content: t.content || '',
            verified: true,
            imageUrl: t.author_avatar_url || ''
          }));
          setAuthTestimonials([...mapped, ...STATIC_TESTIMONIALS]);
        } else {
          setAuthTestimonials(STATIC_TESTIMONIALS);
        }
      } catch {
        setAuthTestimonials(STATIC_TESTIMONIALS);
      }
    };
    fetchData();
  }, []);

  // No separate preload needed — all testimonial images are rendered
  // simultaneously in the DOM and cached via loadedImageCache on load.

  // typing / fade animation for testimonials
  useEffect(() => {
    if (rightView !== 'testimonials') return;
    if (!authTestimonials.length) return;

    const full = String(authTestimonials[authIndex]?.content || '');
    if (full.length === 0) {
      const timeout = setTimeout(() => {
        setIsFading(true);
        const t2 = setTimeout(() => {
          setAuthIndex((p) => (p + 1) % authTestimonials.length);
          setIsFading(false);
        }, 500);
      }, 2000);
      return () => clearTimeout(timeout);
    }

    let i = 0;
    setDisplayedText('');

    let pauseTimeout: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const typeInt = setInterval(() => {
      if (i < full.length) {
        const char = full[i];
        if (char !== undefined) setDisplayedText((p) => p + char);
        i += 1;
      } else {
        clearInterval(typeInt);
        pauseTimeout = setTimeout(() => {
          setIsFading(true);
          fadeTimer = setTimeout(() => {
            setAuthIndex((p) => (p + 1) % authTestimonials.length);
            setIsFading(false);
          }, 500);
        }, 1500);
      }
    }, 40);

    return () => {
      clearInterval(typeInt);
      if (pauseTimeout) clearTimeout(pauseTimeout);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [authIndex, authTestimonials, rightView]);
  const validateEmail = useCallback((em: string) => {
    if (!em) { setEmailError(''); return true; }
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(em)) { setEmailError('Please enter a valid email address'); return false; }
    const domain = em.split('@')[1].toLowerCase();
    const typos: Record<string,string> = { 'gamil.com':'gmail.com','hotnail.com':'hotmail.com','yaho.com':'yahoo.com' };
    if (typos[domain]) { setEmailError(`Did you mean ${typos[domain]}?`); return false; }
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) { setEmailError('Disposable email addresses are not allowed'); return false; }
    setEmailError(''); return true;
  }, []);

  const checkFullNameExists = useCallback(async (name: string) => {
    if (!name.trim() || currentTab !== 'signup') return false;
    setIsCheckingName(true);
    try {
      const { data, error } = await supabase.from('profiles').select('full_name').eq('full_name', name.trim()).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const exists = data !== null;
      setNameError(exists ? 'This name is already taken' : '');
      return exists;
    } catch { setNameError('Error checking name availability'); return true; }
    finally { setIsCheckingName(false); }
  }, [currentTab]);

  useEffect(() => { const t = setTimeout(() => validateEmail(email), 500); return () => clearTimeout(t); }, [email, validateEmail]);
  useEffect(() => {
    if (currentTab === 'signup' && fullName.trim()) { const t = setTimeout(() => checkFullNameExists(fullName), 800); return () => clearTimeout(t); }
  }, [fullName, checkFullNameExists, currentTab]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setIsRedirecting(true); navigate('/dashboard', { replace: true }); }
    });
  }, [navigate]);

  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab as 'signin'|'signup'|'forgot');
    setEmail(''); setPassword(''); setFullName(''); setPromoCode('');
    setEmailError(''); setNameError(''); setShowPassword(false);
    setShowResendVerification(false); setPendingVerificationEmail('');
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    setIsLoading(true);
    let ok = false;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) toast.error('Invalid email or password. Please try again.');
        else if (error.message.includes('Email not confirmed')) {
          toast.error('Please confirm your email before signing in.');
          setPendingVerificationEmail(email.toLowerCase().trim()); setShowResendVerification(true);
        } else toast.error(error.message);
      } else {
        if (promoCode && data.user) {
          try { await supabase.rpc('apply_code_night_promo', { p_user_id: data.user.id, p_promo_code: promoCode.trim() }); toast.success('Promo applied!'); } catch {}
        }
        ok = true; setIsRedirecting(true); navigate('/dashboard', { replace: true });
      }
    } catch { toast.error('An unexpected error occurred.'); }
    finally { if (!ok) setIsLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email) || !fullName.trim() || nameError) { if (!fullName.trim()) toast.error('Please enter your full name.'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setIsLoading(true);
    try {
      if (await checkFullNameExists(fullName.trim())) { toast.error('This full name is already taken.'); return; }
      const referralCode = new URLSearchParams(window.location.search).get('ref');
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(), password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName.trim(), referral_code_used: referralCode || null, promo_code: promoCode ? promoCode.trim().toUpperCase() : null } }
      });
      if (error) {
        if (error.message.includes('already registered')) { toast.error('Email already registered. Please sign in.'); handleTabChange('signin'); setEmail(email); }
        else toast.error(error.message);
      } else {
        if (referralCode && data.user) {
          try { const { error: re } = await supabase.rpc('process_referral_reward', { p_referee_id: data.user.id, p_referral_code: referralCode.toUpperCase() }); if (!re) toast.success('Referral bonus applied! +10 credits.'); } catch {}
        }
        if (promoCode?.trim().toUpperCase() === 'CODENIGHT2026') toast.success('Code Night Offer Applied! 1 month free Premium after verification.');
        
        // Create default notification preferences for new user
        if (data.user) {
          try {
            const { createDefaultNotificationPreferences } = await import('@/services/notificationPreferencesService');
            await createDefaultNotificationPreferences(data.user.id);
          } catch (prefError) {
            console.warn('[Auth] Failed to create notification preferences:', prefError);
            // Don't block signup - this is non-critical
          }
        }
        
        toast.success('Account created! Check your email for a confirmation link.');
        setPendingVerificationEmail(email.toLowerCase().trim()); setShowResendVerification(true);
      }
    } catch { toast.error('An unexpected error occurred during sign-up.'); }
    finally { setIsLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) toast.error(error.message);
      else { toast.success('Password reset email sent!'); handleTabChange('signin'); }
    } catch { toast.error('An unexpected error occurred.'); }
    finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    if (import.meta.env.DEV) {
      console.info('[Auth] Starting Google OAuth sign-in');
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { access_type: 'offline', prompt: 'consent' } }
      });
      if (import.meta.env.DEV) {
        console.info('[Auth] signInWithOAuth response', { error });
      }
      if (error) throw error;
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('[Auth] Google sign-in failed', err);
      }
      toast.error(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  if (isRedirecting) return <BrandedLoader />;

  // ─── Shared style tokens ───────────────────────────────────────────────────
  const IC  = "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none";
  const LBL = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5";
  const INP = (err: boolean) => [
    "w-full pl-10 pr-10 h-11 rounded-xl border text-sm transition-all duration-200",
    "bg-white dark:bg-slate-800/80",
    "text-slate-900 dark:text-slate-100",
    "placeholder:text-slate-400 dark:placeholder:text-slate-600",
    "focus:outline-none focus:ring-2 focus:ring-offset-0",
    err
      ? "border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20"
      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-blue-500/20"
  ].join(' ');
  const PRIMARY_BTN = "w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700";

  const ErrMsg = ({ msg }: { msg: string }) => (
    <p className="flex items-center gap-1 mt-1 text-xs text-red-500 dark:text-red-400">
      <XCircle className="h-3 w-3 flex-shrink-0" />{msg}
    </p>
  );

  const GoogleBtn = ({ label = 'Continue with Google' }: { label?: string }) => (
    <button type="button" onClick={handleGoogleSignIn} disabled={isLoading}
      className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 4.4c1.6 0 3 .56 4 1.52L19.04 2.96A11.6 11.6 0 0 0 12 .4C7.28.4 3.2 3.04 1.28 7.04l4 2.96C6.24 7.52 8.96 5.92 12 5.92V4.4Z" fill="#EA4335"/>
        <path d="M23.6 12c0-.8-.08-1.6-.24-2.4H12v4.8h6.8a5.6 5.6 0 0 1-2.4 3.6v3.44h4.4C23.2 19.2 23.6 15.84 23.6 12Z" fill="#4285F4"/>
        <path d="M12 23.6c2.8 0 5.2-.92 6.8-2.16l-3.2-2.44a7.2 7.2 0 0 1-10.72-3.76L.8 18.08C2.72 22.08 7.28 24.72 12 24.72V23.6Z" fill="#34A853"/>
        <path d="M.4 12c0-.8.08-1.6.24-2.4L4.64 6.64A7.2 7.2 0 0 0 3.92 9.6H.4V12Z" fill="#FBBC04"/>
      </svg>
      {label}
    </button>
  );

  const Divider = () => (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">or</span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex overflow-hidden font-sans">

      {/* ═══ LEFT COLUMN — auth form ═══════════════════════════════════════ */}
      <div
        className={[
          "flex-shrink-0 flex flex-col overflow-y-auto modern-scrollbar transition-colors duration-300",
          "w-full lg:w-[440px] xl:w-[480px]",
          "bg-white dark:bg-slate-900",
          "border-r border-slate-100 dark:border-slate-800",
        ].join(' ')}
      >
        <div className="flex-1 flex flex-col justify-center px-8 py-10 max-w-sm mx-auto w-full">

          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-3 mb-8 group w-fit">
            <OptimizedImage src="/siteimage.png" alt="studdyhub AI Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm" fallbackSrc="/favicon.ico" />
            <span className="text-2xl md:text-3xl font-bold text-blue-700/95 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            StuddyHub
          </span>
          <span className="text-2xl mx-2 md:text-3xl font-bold text-red-600/65 font-claude">AI</span>

          </button>

          {/* ── Sign In ─────────────────────── */}
          {currentTab === 'signin' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to continue your learning journey.</p>
              </div>

              <GoogleBtn />
              <Divider />

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className={LBL}>Email</label>
                  <div className="relative">
                    <Mail className={IC} />
                    <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={INP(!!emailError)} required />
                    {email && <span className="absolute right-3 top-1/2 -translate-y-1/2">{emailError ? <XCircle className="h-4 w-4 text-red-500"/> : <CheckCircle2 className="h-4 w-4 text-emerald-500"/>}</span>}
                  </div>
                  {emailError && <ErrMsg msg={emailError} />}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={LBL} style={{marginBottom:0}}>Password</label>
                    <button type="button" onClick={() => handleTabChange('forgot')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Lock className={IC} />
                    <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className={INP(false)} required />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={LBL}>Promo Code <span className="normal-case font-normal opacity-60">(optional)</span></label>
                  <div className="relative">
                    <Ticket className={IC} />
                    <Input type="text" placeholder="e.g. CODENIGHT2026" value={promoCode} onChange={e => setPromoCode(e.target.value)} className={`${INP(false)} uppercase placeholder:normal-case`} />
                  </div>
                </div>

                <LoadingButton type="submit" isLoading={isLoading} className={PRIMARY_BTN}>Sign In</LoadingButton>
              </form>

              {showResendVerification && pendingVerificationEmail && (
                <ResendVerification email={pendingVerificationEmail} onSuccess={() => setShowResendVerification(false)} />
              )}

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                Don't have an account?{' '}
                <button onClick={() => handleTabChange('signup')} type="button" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Sign up free</button>
              </p>
            </>
          )}

          {/* ── Sign Up ─────────────────────── */}
          {currentTab === 'signup' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Start your learning journey for free.</p>
              </div>

              <GoogleBtn label="Sign up with Google" />
              <Divider />

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className={LBL}>Full Name</label>
                  <div className="relative">
                    <User className={IC} />
                    <Input type="text" placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} className={INP(!!nameError)} required />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingName ? <Loader2 className="h-4 w-4 animate-spin text-slate-400"/> : fullName && !nameError ? <CheckCircle2 className="h-4 w-4 text-emerald-500"/> : nameError ? <XCircle className="h-4 w-4 text-red-500"/> : null}
                    </span>
                  </div>
                  {nameError && <ErrMsg msg={nameError} />}
                </div>

                <div>
                  <label className={LBL}>Email</label>
                  <div className="relative">
                    <Mail className={IC} />
                    <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={INP(!!emailError)} required />
                    {email && <span className="absolute right-3 top-1/2 -translate-y-1/2">{emailError ? <XCircle className="h-4 w-4 text-red-500"/> : <CheckCircle2 className="h-4 w-4 text-emerald-500"/>}</span>}
                  </div>
                  {emailError && <ErrMsg msg={emailError} />}
                </div>

                <div>
                  <label className={LBL}>Password</label>
                  <div className="relative">
                    <Lock className={IC} />
                    <Input type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} className={INP(false)} required minLength={6} />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className={LBL}>Promo Code <span className="normal-case font-normal opacity-60">(optional)</span></label>
                  <div className="relative">
                    <Ticket className={IC} />
                    <Input type="text" placeholder="e.g. CODENIGHT2026" value={promoCode} onChange={e => setPromoCode(e.target.value)} className={`${INP(false)} uppercase placeholder:normal-case`} />
                  </div>
                </div>

                <LoadingButton type="submit" isLoading={isLoading} className={PRIMARY_BTN}>Create Account</LoadingButton>
              </form>

              {showResendVerification && pendingVerificationEmail && (
                <ResendVerification email={pendingVerificationEmail} onSuccess={() => setShowResendVerification(false)} />
              )}

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                Already have an account?{' '}
                <button onClick={() => handleTabChange('signin')} type="button" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Sign in</button>
              </p>
            </>
          )}

          {/* ── Forgot Password ─────────────── */}
          {currentTab === 'forgot' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset your password</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">We'll send a reset link to your inbox.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className={LBL}>Email</label>
                  <div className="relative">
                    <Mail className={IC} />
                    <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className={INP(!!emailError)} required />
                    {email && <span className="absolute right-3 top-1/2 -translate-y-1/2">{emailError ? <XCircle className="h-4 w-4 text-red-500"/> : <CheckCircle2 className="h-4 w-4 text-emerald-500"/>}</span>}
                  </div>
                  {emailError && <ErrMsg msg={emailError} />}
                </div>
                <LoadingButton type="submit" isLoading={isLoading} className={PRIMARY_BTN}>Send Reset Link</LoadingButton>
              </form>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                Remember your password?{' '}
                <button onClick={() => handleTabChange('signin')} type="button" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Back to sign in</button>
              </p>
            </>
          )}

          {/* ToS footer */}
          <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center mt-8 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="/terms-of-service" className="hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy-policy" className="hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* ═══ RIGHT COLUMN — testimonial panel ════════════════════════════════ */}
      <div ref={rightPanelRef} className="hidden lg:flex flex-1 relative overflow-auto bg-slate-900">
        {/* Hero image */}
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/herobackgroundimg.png')" }} />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/80 via-slate-900/90 to-slate-900" />
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '56px 56px' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 py-16 w-full">

          {/* Both panels stay mounted; only one is visible at a time so images are never re-fetched */}
          <div className={rightView === 'walkthrough' ? '' : 'hidden'}>
            <Walkthrough onFinish={() => setRightView('testimonials')} />
          </div>

          <div className={`${rightView === 'testimonials' ? '' : 'hidden'} ${isFading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}> 
              <blockquote className="relative mb-10 max-w-lg">
                <span className="absolute -top-4 -left-2 text-6xl text-blue-500/30 font-serif leading-none select-none">"</span>
                <p className="text-xl xl:text-2xl font-semibold leading-relaxed text-white/85 pl-6 whitespace-pre-wrap">
                  {displayedText || (authTestimonials[authIndex]?.content ?? '')}
                </p>
                <span className="text-6xl text-blue-500/30 font-serif leading-none select-none float-right -mt-4">"</span>
              </blockquote>

              {authTestimonials.length > 0 && (
                <div className="flex items-center gap-4 mb-14 pl-6">
                  <div className="relative h-12 w-12 flex-shrink-0">
                    {authTestimonials.map((t, i) => (
                      <div key={i} className={`absolute inset-0 transition-opacity duration-300 ${i === authIndex ? 'opacity-100' : 'opacity-0'}`}>
                        <OptimizedImage
                          src={t.imageUrl || '/default-avatar.png'}
                          alt={t.name}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-blue-500/30 ring-offset-2 ring-offset-slate-900"
                          fallbackSrc="/default-avatar.png"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{authTestimonials[authIndex]?.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{authTestimonials[authIndex]?.role}</p>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;