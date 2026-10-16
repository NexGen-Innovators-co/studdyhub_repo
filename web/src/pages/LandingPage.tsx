import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../modules/ui/components/button';
import {
  ArrowRight, Users, FileText, Star, Loader2, Mic, MessageSquare,
  Brain, ArrowUp, Download, Check, Zap, Trophy, Globe, Smartphone,
  ChevronRight, Sparkles, Crown, User
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout, ContentContainer } from '../modules/layout/components/LayoutComponents';
import { RateAppDialog } from '../modules/ratings/components/RateAppDialog';

/* ─── Intersection Observer hook for scroll reveals ──────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function RevealDiv({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useReveal();
  return <div ref={ref} className={className} {...props}>{children}</div>;
}

function RevealStagger({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal-stagger ${className}`} {...props}>{children}</div>;
}

const LandingPage: React.FC = () => {
  const [appStats, setAppStats] = useState({
    activeUsers: '0+', totalUsers: '0', notesProcessed: '0+',
    quizzesTaken: '0+', userRating: '0/5',
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [liveTestimonials, setLiveTestimonials] = useState<any[]>([]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchAppStats = async () => {
      setLoadingStats(true);
      try {
        const { data } = await supabase
          .from('app_stats' as any)
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle();
        if (data) {
          setAppStats({
            activeUsers: (data as any).active_users || '0+',
            totalUsers: (data as any).total_users || '0',
            notesProcessed: (data as any).notes_processed || '0+',
            quizzesTaken: (data as any).quizzes_taken || '0+',
            userRating: (data as any).user_rating || '4.9/5',
          });
        }
      } catch { /* fallback defaults */ }
      finally { setLoadingStats(false); }
    };
    fetchAppStats();
  }, []);

  const staticTestimonials = [
    { name: 'Doris', role: 'SHS student', avatar: 'D', content: 'StuddyHub helps me organise my notes and study for exams. The AI chat explains things in a way that actually makes sense.', rating: 5, verified: true, imageUrl: '/testimonial1.jpg' },
    { name: 'Isabel', role: 'Computer Science student at UMaT', avatar: 'I', content: 'The voice recording feature saves me during lectures. I can record everything and search through it later when I revise.', rating: 5, verified: true, imageUrl: '/testimonial3.jpg' },
    { name: 'Dr. Effah Emmanuel', role: 'Computer Science lecturer at UMaT', avatar: 'DE', content: 'My students have told me their study habits have improved since using StuddyHub. The quiz generation tool is particularly useful for exam prep.', rating: 5, verified: true, imageUrl: '/testimonial2.jpg' },
  ];

  const testimonials = [...liveTestimonials, ...staticTestimonials];

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const testimonialRows = await apiClient.rpc('get_approved_testimonials', { p_limit: 20 });
        if (Array.isArray(testimonialRows) && testimonialRows.length > 0) {
          setLiveTestimonials(testimonialRows.map((t: any) => {
            const name = t.author_name || 'StuddyHub User';
            const initials = name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
            return { name, role: 'Verified User', avatar: initials, content: t.content, rating: t.rating, verified: true, imageUrl: t.author_avatar_url || '' };
          }));
        }
      } catch { /* static fallbacks */ }
    };
    fetchLiveData();
  }, []);

  const features = [
    { icon: MessageSquare, title: 'AI Study Assistant', description: 'Chat with an AI that understands your notes and documents. Get step-by-step explanations on any topic, 24/7.', color: '#2F5BEA', image: '/mobile/img_prof_ollie_1786717163116.jpg' },
    { icon: FileText, title: 'Smart Notes', description: 'Rich-text editor with AI-powered summaries, flashcards, and diagram generation from your study material.', color: '#E56B4D', image: '/mobile/img_empty_notes.png' },
    { icon: Brain, title: 'Document Intelligence', description: 'Upload PDFs, slides, or images. StuddyHub extracts key points and lets you chat with your files.', color: '#168C86', image: '/screenshots/documents-light.jpg' },
    { icon: Trophy, title: 'Quizzes & Challenges', description: 'Generate quizzes from any note or document. Join live battles with classmates and earn XP.', color: '#F59E0B', image: '/mobile/img_kente_quiz_1786717209972.jpg' },
    { icon: Mic, title: 'Lecture Recordings', description: 'Record lectures and get AI-powered transcriptions, summaries, and chapter markers for easy revision.', color: '#8B5CF6', image: '/screenshots/recordings-light.jpg' },
    { icon: Users, title: 'Study Groups', description: 'Connect with classmates, share resources, and learn together through social feeds and group chat.', color: '#EC4899', image: '/screenshots/social-light.jpg' },
  ];

  const steps = [
    { number: '01', title: 'Add your materials', description: 'Upload notes, PDFs, lecture recordings, or just start typing. StuddyHub supports all your study formats.', image: '/screenshots/notes-light.jpg' },
    { number: '02', title: 'AI does the heavy lifting', description: 'Our AI analyses your content, creates summaries, generates quizzes, and builds a personalised study plan.', image: '/screenshots/chat-light.jpg' },
    { number: '03', title: 'Study and track progress', description: 'Review with flashcards, take practice quizzes, track your streak, and see your improvement over time.', image: '/screenshots/dashboard-light.jpg' },
  ];

  /* ─── Pricing — exact values from useSubscription.ts + PricingCards.tsx ── */
  const pricingTiers = [
    {
      name: 'Visitor',
      icon: User,
      price: 'Free',
      period: '',
      description: 'Get started with basic features',
      features: [
        { text: '5 AI messages per day', included: true },
        { text: 'Standard AI (Gemini Flash)', included: true },
        { text: '3 notes maximum', included: true },
        { text: '5 document uploads (5MB max)', included: true },
        { text: '1 podcast generation', included: true },
        { text: 'Read-only social feed', included: true },
        { text: 'Unlimited posting', included: false },
        { text: 'Exam mode', included: false },
      ],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Scholar',
      icon: Sparkles,
      price: 'GHS 20',
      period: '/month',
      description: 'Perfect for active learners',
      features: [
        { text: '50 AI messages per day', included: true },
        { text: 'Enhanced AI', included: true },
        { text: 'Unlimited notes', included: true },
        { text: '20 document uploads (25MB max)', included: true },
        { text: '5 podcast generations', included: true },
        { text: 'Full social access + posting', included: true },
        { text: 'Exam mode', included: false },
        { text: 'Verified badge', included: false },
      ],
      cta: 'Get Scholar',
      highlighted: true,
    },
    {
      name: 'Genius',
      icon: Crown,
      price: 'GHS 50',
      period: '/month',
      description: 'Unlock everything',
      features: [
        { text: 'Unlimited AI messages', included: true },
        { text: 'Pro AI', included: true },
        { text: 'Unlimited notes', included: true },
        { text: 'Unlimited uploads (100MB max)', included: true },
        { text: 'Unlimited podcasts', included: true },
        { text: 'Full social access + posting', included: true },
        { text: 'Exam mode', included: true },
        { text: 'Verified badge', included: true },
      ],
      cta: 'Get Genius',
      highlighted: false,
    },
  ];

  return (
    <AppLayout>
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-white dark:bg-[#0c1520] text-[#122033] dark:text-white">
        {/* Gradient mesh blobs — lighter in light mode */}
        <div className="absolute top-[-300px] right-[-200px] w-[700px] h-[700px] rounded-full bg-[#2F5BEA] opacity-[0.04] dark:opacity-[0.08] blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-200px] left-[-150px] w-[500px] h-[500px] rounded-full bg-[#E56B4D] opacity-[0.03] dark:opacity-[0.06] blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] left-[40%] w-[400px] h-[400px] rounded-full bg-[#168C86] opacity-[0.03] dark:opacity-[0.05] blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto min-h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex items-center z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
            <div className="hero-eyebrow-in">
              {/* <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#168C86] animate-pulse" />
                <span className="text-xs font-semibold text-gray-500 dark:text-white/70 uppercase tracking-wider">AI-powered study workspace</span>
              </div> */}

              <h1 className="hero-title-in text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] sm:leading-[1.02] tracking-tight text-[#122033] dark:text-white mb-6 max-w-xl">
                Study smarter.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E56B4D] via-[#2F5BEA] to-[#168C86]">Score higher.</span>
              </h1>

              <p className="hero-copy-in text-lg text-gray-500 dark:text-white/60 max-w-lg mb-8 leading-relaxed">
                StuddyHub turns your notes, documents, and recordings into AI-powered quizzes, summaries, and study plans so every session moves you forward.
              </p>

              <div className="hero-copy-in flex flex-row flex-wrap sm:flex-row gap-3 mb-8">
                <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
                  <Button className="min-h-12 px-7 bg-[#2F5BEA] hover:bg-[#2448c5] text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_30px_rgba(47,91,234,0.3)]">
                    <Download className="h-4 w-4 mr-2" />
                    Android
                  </Button>
                </a>
                <Link to="/auth">
                  <Button variant="outline" className="min-h-12 px-7 border-gray-300 dark:border-white/20 bg-gray-50 dark:bg-white/5 text-[#122033] dark:text-white font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 hover:text-[#122033] dark:hover:text-white hover:border-gray-400 dark:hover:border-white/30 transition-all">
                    Try on the web
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="hero-capability-in flex items-center gap-4 text-sm text-gray-400 dark:text-white/40">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#168C86]" />
                  <span>Free to start</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#168C86]" />
                  <span>No credit card</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#168C86]" />
                  <span>Web & Android</span>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:flex justify-center items-center">
              <div className="relative float">
                <div className="absolute -inset-12 bg-gradient-to-br from-[#2F5BEA]/20 to-[#E56B4D]/10 rounded-3xl blur-3xl" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-w-[380px]">
                  <img src="/mobile/img_onboarding_hero.png" alt="StuddyHub onboarding" className="w-full h-auto" />
                </div>
                <div className="absolute -bottom-6 -left-10 float-delayed">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl border-2 border-gray-200 dark:border-white/20 bg-white">
                    <img src="/mobile/img_study_mascot.png" alt="Ollie mascot" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="absolute -top-3 -right-6 float-delayed bg-white dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-900 dark:text-white">+150 XP</p>
                    <p className="text-[9px] text-gray-500 dark:text-white/50">Quiz Master</p>
                  </div>
                </div>
                {/* <div className="absolute top-1/2 -left-14 float bg-white dark:bg-white/10 backdrop-blur-md border border-gray-200 dark:border-white/15 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-900 dark:text-white">12-day streak</p>
                    <p className="text-[9px] text-gray-500 dark:text-white/50">Keep going!</p>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — TRUST BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <RevealDiv className="py-14 bg-white dark:bg-[#182431] border-b public-rule">
        <ContentContainer>
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Trusted by students across Ghana
            </p>
          </div>
          {loadingStats ? (
            <div className="flex justify-center h-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <RevealStagger className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {[
                { value: appStats.totalUsers, label: 'Students' },
                { value: appStats.notesProcessed, label: 'Notes created' },
                { value: appStats.quizzesTaken, label: 'Quizzes taken' },
                { value: appStats.userRating, label: 'App rating' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="public-display text-3xl md:text-4xl text-[#122033] dark:text-white">{stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </RevealStagger>
          )}
        </ContentContainer>
      </RevealDiv>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — PLATFORMS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-24 bg-[#F7F8F5] dark:bg-[#101923] border-b public-rule overflow-hidden mesh-gradient mesh-blue">
        <ContentContainer>
          <RevealDiv className="text-center mb-16 relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F5BEA] mb-3">Available on</p>
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              Two platforms. One experience.
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
              Use StuddyHub wherever you are — on the web or on your Android device. Your data syncs seamlessly across both.
            </p>
          </RevealDiv>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto relative z-10">
            <RevealDiv className="reveal-left group">
              <div className="bg-white dark:bg-[#182431] rounded-2xl border public-rule overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
                <div className="aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                  <img src="/screenshots/dashboard-light.jpg" alt="StuddyHub Web App" className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-[#2F5BEA]" />
                    </div>
                    <div>
                      <h3 className="public-display text-xl text-[#122033] dark:text-white">Web App</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">app.studdyhub.com</p>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                    Full-featured study workspace in your browser. Access your notes, documents, AI chat, quizzes, and social feed from any device.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {['No installation required', 'Works on any device with a browser', 'Real-time sync with the mobile app'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="h-3.5 w-3.5 text-[#168C86] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full rounded-lg font-semibold">
                      Open Web App
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </RevealDiv>

            <RevealDiv className="reveal-right group">
              <div className="bg-white dark:bg-[#182431] rounded-2xl border public-rule overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
                <div className="aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                  <img src="/mobile/ic_explorer_hero.jpg" alt="StuddyHub Android App" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-white" />
                    <span className="text-xs font-semibold text-white">Android App</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-[#168C86]" />
                    </div>
                    <div>
                      <h3 className="public-display text-xl text-[#122033] dark:text-white">Android App</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Direct APK download</p>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                    Native Android experience with offline access, push notifications, and full feature access including live quiz battles and lecture recording.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {['Offline access to notes and quizzes', 'Native lecture recording & transcription', 'Push notifications for study reminders'].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="h-3.5 w-3.5 text-[#168C86] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
                    <Button className="w-full rounded-lg font-semibold bg-[#2F5BEA] text-white hover:bg-[#2448c5]">
                      <Download className="h-4 w-4 mr-2" />
                      Download APK
                    </Button>
                  </a>
                </div>
              </div>
            </RevealDiv>
          </div>
        </ContentContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-24 bg-white dark:bg-[#182431] border-b public-rule overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#2F5BEA] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />
        <ContentContainer>
          <RevealDiv className="text-center mb-16 relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C86] mb-3">How it works</p>
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              Three steps to better study
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
              No complicated setup. Just add your materials and let AI do the rest.
            </p>
          </RevealDiv>

          <RevealStagger className="grid md:grid-cols-3 gap-6 relative z-10">
            {steps.map((step, index) => (
              <div key={step.number} className="relative group">
                <div className="bg-[#F7F8F5] dark:bg-[#101923] rounded-2xl border public-rule overflow-hidden hover:shadow-lg transition-all duration-500">
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img src={step.image} alt={step.title} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <div className="absolute top-3 left-3 w-10 h-10 rounded-xl bg-[#2F5BEA] flex items-center justify-center shadow-lg">
                      <span className="public-display text-sm text-white">{step.number}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="public-display text-xl text-[#122033] dark:text-white mb-2">{step.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 z-20 w-8 h-8 bg-white dark:bg-[#182431] border public-rule rounded-full items-center justify-center shadow-sm">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </RevealStagger>
        </ContentContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — FEATURES
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-16 md:py-24 bg-[#F7F8F5] dark:bg-[#101923] border-b public-rule overflow-hidden mesh-gradient mesh-coral">
        <ContentContainer>
          <RevealDiv className="text-center mb-16 relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E56B4D] mb-3">Everything you need</p>
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              One app for your entire study life
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
              From note-taking to exam prep, StuddyHub connects every part of your study workflow.
            </p>
          </RevealDiv>

          <RevealStagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-white dark:bg-[#182431] rounded-2xl border public-rule overflow-hidden hover:shadow-xl hover:border-transparent transition-all duration-500"
              >
                <div className="aspect-[16/9] overflow-hidden relative bg-gray-100 dark:bg-gray-800">
                  <img src={feature.image} alt={feature.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: feature.color }}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="public-display text-lg text-[#122033] dark:text-white mb-1.5">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </RevealStagger>

          {/* Mid-page CTA */}
          <RevealDiv className="text-center mt-12 relative z-10">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
                <Button className="px-6 py-3 bg-[#2F5BEA] hover:bg-[#2448c5] text-white font-semibold rounded-lg transition-all">
                  <Download className="h-4 w-4 mr-2" />
                  Download for Android
                </Button>
              </a>
              <Link to="/auth">
                <Button variant="outline" className="px-6 py-3 font-semibold rounded-lg">
                  Try on the web
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </RevealDiv>
        </ContentContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — PRICING (moved up for conversion)
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-16 md:py-24 bg-white dark:bg-gray-950 border-b public-rule overflow-hidden">
        <ContentContainer>
          <RevealDiv className="text-center mb-16 relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F5BEA] mb-3">Simple pricing</p>
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              Start free. Upgrade when ready.
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
              Every plan includes the core study tools. Upgrade for more AI, more storage, and premium features.
            </p>
          </RevealDiv>

          <RevealStagger className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto relative z-10">
            {pricingTiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl p-6 border transition-all duration-500 ${tier.highlighted
                    ? 'bg-[#122033] dark:bg-[#1a3050] border-[#2F5BEA] text-white shadow-xl scale-[1.02] hover:shadow-[0_0_40px_rgba(47,91,234,0.15)]'
                    : 'bg-white dark:bg-[#182431] public-rule shadow-sm hover:shadow-lg'
                    }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2F5BEA] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tier.highlighted ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                      <Icon className={`h-5 w-5 ${tier.highlighted ? 'text-white' : 'text-[#2F5BEA]'}`} />
                    </div>
                    <div>
                      <h3 className={`public-display text-xl ${tier.highlighted ? 'text-white' : 'text-[#122033] dark:text-white'}`}>{tier.name}</h3>
                      <p className={`text-xs ${tier.highlighted ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{tier.description}</p>
                    </div>
                  </div>
                  <div className="mb-5">
                    <span className={`public-display text-4xl ${tier.highlighted ? 'text-white' : 'text-[#122033] dark:text-white'}`}>{tier.price}</span>
                    {tier.period && <span className={`text-sm ml-1 ${tier.highlighted ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>{tier.period}</span>}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature) => (
                      <li key={feature.text} className="flex items-center gap-2.5 text-sm">
                        <Check className={`h-4 w-4 flex-shrink-0 ${feature.included
                          ? tier.highlighted ? 'text-teal-300' : 'text-[#168C86]'
                          : tier.highlighted ? 'text-white/20' : 'text-gray-300 dark:text-gray-600'
                          }`} />
                        <span className={
                          feature.included
                            ? tier.highlighted ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'
                            : tier.highlighted ? 'text-white/30 line-through' : 'text-gray-400 dark:text-gray-600 line-through'
                        }>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button
                      className={`w-full rounded-lg font-semibold transition-all duration-300 ${tier.highlighted
                        ? 'bg-white text-[#122033] hover:bg-gray-100 hover:shadow-lg'
                        : 'bg-[#2F5BEA] text-white hover:bg-[#2448c5] hover:shadow-[0_0_20px_rgba(47,91,234,0.2)]'
                        }`}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </RevealStagger>
        </ContentContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — TESTIMONIALS
      ═══════════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-16 md:py-20 bg-[#F7F8F5] dark:bg-[#101923]">
        <ContentContainer>
          <RevealDiv className="text-center mb-12">
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              What students say
            </h2>
            <div className="mt-4">
              <RateAppDialog
                trigger={
                  <Button variant="outline" className="gap-2 text-sm rounded-lg">
                    <Star className="h-4 w-4" />
                    Leave a review
                  </Button>
                }
              />
            </div>
          </RevealDiv>

          <RevealStagger className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <div
                key={index}
                className="bg-white dark:bg-[#182431] rounded-2xl p-6 border public-rule hover:shadow-md transition-shadow"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-5">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    {testimonial.imageUrl ? (
                      <img src={testimonial.imageUrl} alt={testimonial.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium">
                        {testimonial.avatar}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{testimonial.name}</span>
                      {testimonial.verified && (
                        <svg className="h-3.5 w-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{testimonial.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </RevealStagger>
        </ContentContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — FINAL CTA
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 bg-[#122033] overflow-hidden">
        <div className="absolute inset-0">
          <img src="/mobile/studdyhub_banner.png" alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#122033] via-[#122033]/80 to-[#122033]" />
        </div>
        <div className="absolute top-[-100px] left-[50%] -translate-x-1/2 w-[600px] h-[300px] bg-[#2F5BEA] opacity-[0.08] blur-[100px] rounded-full pointer-events-none" />

        <ContentContainer>
          <RevealDiv className="reveal-scale max-w-2xl mx-auto text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Start studying smarter today
            </h2>
            <p className="text-white/50 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
              Join thousands of students using AI to study smarter, not harder. Free to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
                <Button className="px-7 py-3.5 bg-[#2F5BEA] hover:bg-[#2448c5] text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_30px_rgba(47,91,234,0.3)]">
                  <Download className="h-4 w-4 mr-2" />
                  Download for Android
                </Button>
              </a>
              <Link to="/auth">
                <Button variant="outline" className="px-7 py-3.5 border-white/20 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 hover:text-white hover:border-white/30 transition-all">
                  Sign up for free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </RevealDiv>
        </ContentContainer>
      </section>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 p-3 bg-[#122033] dark:bg-gray-700 text-white rounded-full shadow-lg hover:bg-[#1a3050] dark:hover:bg-gray-600 transition-all hover:shadow-xl hover:scale-110"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </AppLayout>
  );
};

export default LandingPage;
