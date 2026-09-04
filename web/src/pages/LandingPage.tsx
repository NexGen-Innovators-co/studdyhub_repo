// src/pages/LandingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../modules/ui/components/button';
import { ArrowRight, Users, FileText, Star, ChevronLeft, ChevronRight, Loader2, Mic, MessageSquare, Brain, LayoutDashboard, ArrowUp, Download } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout, ContentContainer } from '../modules/layout/components/LayoutComponents';
import { RateAppDialog } from '../modules/ratings/components/RateAppDialog';
import { ScreenshotGallery } from '../modules/layout/components/ScreenshotGallery';

const appScreenshots = [
  { id: 1, title: "Dashboard", description: "Track progress and upcoming deadlines", darkUrl: "/screenshots/dashboard-dark.jpg", lightUrl: "/screenshots/dashboard-light.jpg", category: "Dashboard" },
  { id: 2, title: "AI Chat", description: "Ask questions and get instant explanations", darkUrl: "/screenshots/chat-dark.jpg", lightUrl: "/screenshots/chat-light.jpg", category: "AI Assistant" },
  { id: 3, title: "Notes", description: "Rich editor with AI-powered organisation", darkUrl: "/screenshots/notes-dark.jpg", lightUrl: "/screenshots/notes-light.jpg", category: "Notes" },
  { id: 4, title: "Documents", description: "Upload PDFs and study materials for analysis", darkUrl: "/screenshots/documents-dark.jpg", lightUrl: "/screenshots/documents-light.jpg", category: "Documents" },
  { id: 5, title: "Recordings", description: "Record and transcribe lectures", darkUrl: "/screenshots/recordings-dark.jpg", lightUrl: "/screenshots/recordings-light.jpg", category: "Recordings" },
  { id: 6, title: "Analytics", description: "Visualise your learning progress", darkUrl: "/screenshots/dashboardanalytics-dark.jpg", lightUrl: "/screenshots/dashboardanalytics-light.jpg", category: "Analytics" },
  { id: 7, title: "Social", description: "Connect with classmates and study groups", darkUrl: "/screenshots/social-dark.jpg", lightUrl: "/screenshots/social-light.jpg", category: "Social" },
];

const heroCapabilities = [
  {
    eyebrow: 'The new Explorer experience',
    title: 'Learning that feels like progress.',
    description: 'Meet Ollie, your friendly AI study buddy. Learn through stories, quick challenges, flashcards, and games that make every session feel worth coming back to.',
    label: 'Understand',
    capabilityTitle: 'Ask Ollie anything.',
    capabilityDescription: 'Get friendly, step-by-step explanations that make difficult ideas easier to grasp.',
    support: 'A little help can change the whole study session.',
    icon: MessageSquare,
    accent: '#8FD8FF',
  },
  {
    eyebrow: 'Practice without the pressure',
    title: 'Turn learning into play.',
    description: 'Challenge yourself with quizzes, battles, spelling, maths, and quick daily activities that make practice feel rewarding.',
    label: 'Practice',
    capabilityTitle: 'Your next challenge is ready.',
    capabilityDescription: 'Try a quick quiz, enter a battle, or build confidence one small answer at a time.',
    support: 'Small wins add up to real understanding.',
    icon: Brain,
    accent: '#FFB08D',
  },
  {
    eyebrow: 'Make progress visible',
    title: 'Build progress that lasts.',
    description: 'Collect XP, unlock badges, grow your streak, and follow a roadmap made for the goals you want to reach.',
    label: 'Remember',
    capabilityTitle: 'Every session leaves a mark.',
    capabilityDescription: 'See your streak grow, collect badges, and know exactly what to try next.',
    support: 'Progress feels better when you can see it.',
    icon: Star,
    accent: '#8DE0C8',
  },
  {
    eyebrow: 'Learning is better together',
    title: 'Study with your people.',
    description: 'Share ideas, join study groups, and learn alongside classmates wherever you are.',
    label: 'Connect',
    capabilityTitle: 'Bring your study group in.',
    capabilityDescription: 'Share ideas, compare answers, and make revision feel less like something you do alone.',
    support: 'There is always another way to learn it.',
    icon: Users,
    accent: '#FFD57A',
  },
];

const LandingPage: React.FC = () => {
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [appStats, setAppStats] = useState({
    activeUsers: '0+', totalUsers: '0', notesProcessed: '0+', quizzesTaken: '0+',
    podcastsGenerated: '0+', userRating: '0/5',
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [liveTestimonials, setLiveTestimonials] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeCapability, setActiveCapability] = useState(0);
  const [isCapabilityPaused, setIsCapabilityPaused] = useState(false);

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
            podcastsGenerated: (data as any).podcasts_generated || '0+',
            userRating: (data as any).user_rating || '4.9/5',
          });
        }
      } catch { /* fallback defaults */ }
      finally { setLoadingStats(false); }
    };
    fetchAppStats();
  }, []);

  const staticTestimonials = [
    { name: "Doris", role: "SHS student", avatar: "D", content: "StuddyHub helps me organise my notes and study for exams. The AI chat explains things in a way that actually makes sense.", rating: 5, verified: true, imageUrl: "/testimonial1.jpg" },
    { name: "Isabel", role: "Computer Science student at UMaT", avatar: "I", content: "The voice recording feature saves me during lectures. I can record everything and search through it later when I revise.", rating: 5, verified: true, imageUrl: '/testimonial3.jpg' },
    { name: "Dr. Effah Emmanuel", role: "Computer Science lecturer at UMaT", avatar: "DE", content: "My students have told me their study habits have improved since using StuddyHub. The quiz generation tool is particularly useful for exam prep.", rating: 5, verified: true, imageUrl: '/testimonial2.jpg' },
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

  const nextTestimonial = () => setCurrentTestimonialIndex((prev) => (prev + 1) % testimonials.length);
  const prevTestimonial = () => setCurrentTestimonialIndex((prev) => prev === 0 ? testimonials.length - 1 : prev - 1);

  useEffect(() => {
    const interval = setInterval(nextTestimonial, 7000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  useEffect(() => {
    if (isCapabilityPaused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => {
      setActiveCapability((current) => (current + 1) % heroCapabilities.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isCapabilityPaused]);

  const capability = heroCapabilities[activeCapability];

  const features = [
    { icon: LayoutDashboard, title: "Dashboard", description: "Track study streaks, deadlines, and recent activity in one place." },
    { icon: MessageSquare, title: "AI Chat", description: "Ask questions, clarify concepts, and get help on any topic — available 24/7." },
    { icon: FileText, title: "Smart Notes", description: "Rich-text editor with AI summarisation and auto-formatting for organised study material." },
    { icon: Brain, title: "Document Analysis", description: "Upload PDFs or slides, then chat with your documents to extract key points and generate quizzes." },
    { icon: Mic, title: "Podcasts & Recordings", description: "Record lectures and create study podcasts with AI transcription and chapter markers." },
    { icon: Users, title: "Study Groups", description: "Join groups, share resources, and participate in live quiz sessions with classmates." },
  ];

  return (
    <AppLayout>
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#122033] bg-cover bg-[center_right] text-white md:bg-center" style={{ backgroundImage: "url('/heroBg.png')" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#122033]/90 via-[#122033]/58 to-[#122033]/15" />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#122033]/65 via-[#122033]/25 to-transparent" />
        <div className="relative max-w-6xl mx-auto min-h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 py-20 md:py-28 flex items-center">
          <div className="w-full px-12 md:px-16">
            <div className={`relative z-10 max-w-3xl ${activeCapability % 2 === 1 ? 'hero-slide-right' : ''}`}>
              <p key={`${capability.label}-eyebrow`} className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9b80] mb-5 hero-eyebrow-in">
                {capability.eyebrow}
              </p>
              <h1 key={`${capability.label}-title`} className="public-display text-5xl sm:text-6xl lg:text-7xl font-normal leading-[0.98] text-white mb-7 max-w-2xl hero-title-in">
                {capability.title}
              </h1>
              <p key={`${capability.label}-description`} className="text-lg text-blue-100 max-w-lg mb-8 leading-relaxed hero-copy-in">
                {capability.description}
              </p>
              <div
                key={`${capability.label}-capability`}
                className="max-w-xl border-l-2 pl-5 mb-8 min-h-[118px] hero-capability-in"
                style={{ borderColor: capability.accent }}
                onMouseEnter={() => setIsCapabilityPaused(true)}
                onMouseLeave={() => setIsCapabilityPaused(false)}
              >
                <div className="flex items-center gap-3 mb-2">
                  <capability.icon className="h-5 w-5" style={{ color: capability.accent }} />
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">{capability.label}</span>
                </div>
                <h2 key={capability.capabilityTitle} className="text-2xl font-bold text-white animate-in fade-in slide-in-from-left-2 duration-500 mb-1">{capability.capabilityTitle}</h2>
                <p key={capability.capabilityDescription} className="text-sm text-blue-100 leading-relaxed animate-in fade-in duration-700">{capability.capabilityDescription}</p>
              </div>
              <p key={`${capability.label}-support`} className="text-sm text-blue-200 mb-8 hero-copy-in">{capability.support}</p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
                  <Button className="min-h-12 px-6 bg-[#2F5BEA] hover:bg-[#2448c5] text-white font-semibold rounded-md transition-colors">
                    Download the Android app <Download className="h-4 w-4 ml-2" />
                  </Button>
                </a>
                <a href="#features">
                  <Button variant="outline" className="min-h-12 px-6 border-white/50 bg-white/10 text-white font-semibold rounded-md hover:bg-white/20 hover:text-white transition-colors">
                    Explore the experience
                  </Button>
                </a>
              </div>
              <p className="text-sm text-blue-200">Built for curious learners. Designed to make practice feel less like pressure.</p>
            </div>
          </div>
          {/* <button type="button" onClick={() => setActiveCapability((activeCapability - 1 + heroCapabilities.length) % heroCapabilities.length)} className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 h-12 w-12 inline-flex items-center justify-center border border-white/40 bg-[#122033]/40 text-white hover:bg-white/15 transition-colors z-20" aria-label="Previous hero slide">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setActiveCapability((activeCapability + 1) % heroCapabilities.length)} className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 h-12 w-12 inline-flex items-center justify-center border border-white/40 bg-[#122033]/40 text-white hover:bg-white/15 transition-colors z-20" aria-label="Next hero slide">
            <ChevronRight className="h-5 w-5" />
          </button> */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20" aria-label="Hero slides">
            {heroCapabilities.map((item, index) => (
              <button key={item.label} type="button" onClick={() => setActiveCapability(index)} className={`h-1.5 transition-all ${index === activeCapability ? 'w-10 bg-white' : 'w-2 bg-white/50'}`} aria-label={`Show ${item.label} slide`} />
            ))}
          </div>
        </div>
      </section>

      {/* What's New */}
      <section className="py-8 bg-white dark:bg-[#182431] border-b public-rule">
        <ContentContainer>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="md:w-1/4">
              <p className="text-xs font-bold text-[#E56B4D] mb-2 tracking-[0.16em] uppercase">Latest release / v1.0-beta.3</p>
              <h2 className="public-display text-2xl font-normal text-[#122033] dark:text-white">Explorer is ready to play.</h2>
            </div>
            <div className="md:w-3/4 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="border-l-2 border-[#E56B4D] pl-4">
                <h3 className="font-semibold text-[#122033] dark:text-white text-sm mb-1">Meet Ollie</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs">A friendly AI tutor that explains ideas with stories and examples.</p>
              </div>
              <div className="border-l-2 border-[#168C86] pl-4">
                <h3 className="font-semibold text-[#122033] dark:text-white text-sm mb-1">Learn by playing</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Take on quick quizzes, battles, and learning games.</p>
              </div>
              <div className="border-l-2 border-[#2F5BEA] pl-4">
                <h3 className="font-semibold text-[#122033] dark:text-white text-sm mb-1">Keep your progress</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Earn XP, build streaks, collect badges, and follow your roadmap.</p>
              </div>
            </div>
          </div>
          <div className="mt-6 md:ml-[25%]">
            <a href="/studdyhub-v1.0-beta.3.apk" download="studdyhub-v1.0-beta.3.apk">
              <Button variant="outline" className="px-5 py-2.5 text-sm font-medium rounded-lg">
                <Download className="h-4 w-4 mr-2" />
                Download v1.0-beta.3
              </Button>
            </a>
          </div>
        </ContentContainer>
      </section>

      {/* Stats */}
      <section className="py-10 bg-[#F7F8F5] dark:bg-[#101923] border-b public-rule">
        <ContentContainer>
          {loadingStats ? (
            <div className="flex justify-center h-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
              {[
                { value: appStats.activeUsers, label: 'Active Users' },
                { value: appStats.totalUsers, label: 'Total Users' },
                { value: appStats.notesProcessed, label: 'Notes Created' },
                { value: appStats.quizzesTaken, label: 'Quizzes Taken' },
                { value: appStats.podcastsGenerated, label: 'Podcasts' },
              ].map((stat, i) => (
                <div key={i} className="text-center md:text-left">
                  <div className="public-display text-3xl font-normal text-[#122033] dark:text-white">{stat.value}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </ContentContainer>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white dark:bg-[#182431] border-b public-rule">
        <ContentContainer>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C86] mb-3">The study loop</p>
            <h2 className="public-display text-4xl md:text-5xl font-normal text-[#122033] dark:text-white mb-4">
              From scattered material to a way forward.
            </h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              StuddyHub keeps the useful parts of a study session connected, so each tool helps the next one do more.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t public-rule">
            {[
              { title: 'Understand', description: 'Ask questions of your notes and documents until the difficult part becomes clear.', image: '/screenshots/chat-light.jpg', color: '#2F5BEA', icon: MessageSquare },
              { title: 'Organize', description: 'Keep notes, recordings, deadlines, and study material in one calm, searchable place.', image: '/screenshots/notes-light.jpg', color: '#E56B4D', icon: FileText },
              { title: 'Study together', description: 'Turn your material into quizzes, podcasts, and conversations with classmates.', image: '/screenshots/social-light.jpg', color: '#168C86', icon: Users },
            ].map((story, index) => (
              <div key={story.title} className={`py-8 lg:px-8 ${index > 0 ? 'lg:border-l public-rule' : 'lg:pr-8'}`}>
                <div className="flex items-center gap-3 mb-5">
                  <story.icon className="h-5 w-5" style={{ color: story.color }} />
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">0{index + 1}</span>
                </div>
                <h3 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-3">{story.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6">{story.description}</p>
                <img src={story.image} alt={`${story.title} in StuddyHub`} className="w-full aspect-[4/3] object-cover object-top border public-rule" />
              </div>
            ))}
          </div>
        </ContentContainer>
      </section>

      {/* Screenshots */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <ContentContainer>
          <ScreenshotGallery
            screenshots={appScreenshots}
            title="See the App"
            description="Available on Android with dark and light mode support"
            showThemeToggle={true}
          />
        </ContentContainer>
      </section>

      {/* Demo */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <ContentContainer>
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              See it in action
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Watch a quick walkthrough of the platform.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <iframe
                src="https://app.supademo.com/embed/cmiuw8fc53q0ml821m200i3ra"
                className="absolute inset-0 w-full h-full"
                title="StuddyHub Demo"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </ContentContainer>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white dark:bg-gray-950">
        <ContentContainer>
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
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
          </div>

          <div className="relative max-w-4xl">
            <div ref={carouselRef} className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentTestimonialIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-1">
                    <div className="flex flex-col md:flex-row gap-6 items-start p-6 md:p-8 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">
                          {testimonial.imageUrl ? (
                            <img src={testimonial.imageUrl} alt={testimonial.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg font-medium">
                              {testimonial.avatar}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex gap-0.5 mb-3">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                          ))}
                        </div>
                        <blockquote className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                          "{testimonial.content}"
                        </blockquote>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{testimonial.name}</span>
                          {testimonial.verified && (
                            <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className="text-gray-500 dark:text-gray-400 text-sm">· {testimonial.role}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonialIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === currentTestimonialIndex ? 'bg-blue-600 w-6' : 'bg-gray-300 dark:bg-gray-600 w-1.5'}`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </ContentContainer>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900 dark:bg-gray-950">
        <ContentContainer>
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Start studying smarter today
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Free to get started. No credit card required.
            </p>
            <Link to="/auth">
              <Button className="px-6 py-3 bg-white text-gray-900 hover:bg-gray-100 font-medium rounded-lg transition-colors">
                Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </ContentContainer>
      </section>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 p-3 bg-gray-900 dark:bg-gray-700 text-white rounded-full shadow-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </AppLayout>
  );
};

export default LandingPage;
