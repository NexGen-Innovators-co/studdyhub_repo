// src/pages/LandingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Sparkles, ArrowRight, Play, Shield, Globe, Award, Users, FileText, TrendingUp, Star, Zap, ChevronLeft, ChevronRight, Loader2, Mic, MessageSquare, Brain, LayoutDashboard, ArrowUp } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AppLayout, ContentContainer } from '../components/layout/LayoutComponents'
// Update src/pages/LandingPage.tsx - Add this after features section
import { ScreenshotGallery } from '../components/layout/ScreenshotGallery';
const appScreenshots = [
  {
    id: 1,
    title: "Dashboard Overview",
    description: "Your personalized learning dashboard with AI insights and progress tracking",
    darkUrl: "/screenshots/dashboard-dark.jpg", // Your dark mode screenshot
    lightUrl: "/screenshots/dashboard-light.jpg", // Your light mode screenshot
    category: "Dashboard"
  },
  {
    id: 2,
    title: "AI Chat Interface",
    description: "Interactive conversation with your AI learning assistant",
    darkUrl: "/screenshots/chat-dark.jpg",
    lightUrl: "/screenshots/chat-light.jpg",
    category: "AI Assistant"
  },
  {
    id: 3,
    title: "Smart Note Editor",
    description: "Rich text editor with AI-powered suggestions",
    darkUrl: "/screenshots/notes-dark.jpg",
    lightUrl: "/screenshots/notes-light.jpg",
    category: "Notes"
  },
  {
    id: 4,
    title: "Document Analysis",
    description: "Upload and analyze documents with AI insights",
    darkUrl: "/screenshots/documents-dark.jpg",
    lightUrl: "/screenshots/documents-light.jpg",
    category: "Documents"
  },
  {
    id: 5,
    title: "Voice Recording",
    description: "Record and transcribe lectures automatically",
    darkUrl: "/screenshots/recordings-dark.jpg",
    lightUrl: "/screenshots/recordings-light.jpg",
    category: "Recordings"
  },
  {
    id: 6,
    title: "Progress Analytics",
    description: "Track your learning progress with detailed analytics",
    darkUrl: "/screenshots/dashboardanalytics-dark.jpg",
    lightUrl: "/screenshots/dashboardanalytics-light.jpg",
    category: "Analytics"
  },
  {
    id: 7,
    title: "Social networking",
    description: "Connect with individuals in your scope of studies",
    darkUrl: "/screenshots/social-dark.jpg",
    lightUrl: "/screenshots/social-light.jpg",
    category: "social feeds"
  }
];

const LandingPage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [appStats, setAppStats] = useState({
    activeUsers: '0+',
    notesProcessed: '0+',
    uptime: '0%',
    userRating: '0/5',
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle scroll-to-top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const featureInterval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(featureInterval);
  }, []);

  // Fetch App Stats from Supabase
  useEffect(() => {
    const fetchAppStats = async () => {
      setLoadingStats(true);
      try {
        const { data, error } = await supabase
          .from('app_stats')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();

        if (error && error.code === 'PGRST116') {
          const defaultStats = {
            id: '00000000-0000-0000-0000-000000000001',
            active_users: '50K+',
            notes_processed: '1M+',
            uptime: '99.9%',
            user_rating: '4.9/5',
          };
          const { error: insertError } = await supabase
            .from('app_stats')
            .insert([defaultStats]);

          if (insertError) {
            //console.error("Error inserting default app stats:", insertError);
            setAppStats({
              activeUsers: '50K+',
              notesProcessed: '1M+',
              uptime: '99.9%',
              userRating: '4.9/5',
            });
          } else {
            setAppStats({
              activeUsers: defaultStats.active_users,
              notesProcessed: defaultStats.notes_processed,
              uptime: defaultStats.uptime,
              userRating: defaultStats.user_rating,
            });
          }
        } else if (error) {
          //console.error("Error fetching app stats from Supabase:", error);
          setAppStats({
            activeUsers: '50K+',
            notesProcessed: '1M+',
            uptime: '99.9%',
            userRating: '4.9/5',
          });
        } else if (data) {
          setAppStats({
            activeUsers: data.active_users || '0+',
            notesProcessed: data.notes_processed || '0+',
            uptime: data.uptime || '0%',
            userRating: data.user_rating || '0/5',
          });
        }
      } catch (error) {
        //console.error("Unexpected error fetching app stats:", error);
        setAppStats({
          activeUsers: '50K+',
          notesProcessed: '1M+',
          uptime: '99.9%',
          userRating: '4.9/5',
        });
      } finally {
        setLoadingStats(false);
      }
    };

    fetchAppStats();
  }, []);

  const testimonials = [
    {
      name: "Doris",
      role: "SHS student",
      avatar: "D",
      content: "StuddyHub AI has completely revolutionized how I study. The AI chat is incredibly helpful, and the document analysis saves me so much time!",
      rating: 5,
      verified: true,
      imageUrl: "/testimonial1.jpg"
    },
    {
      name: "Isabel",
      role: "Computer Science student at UMaT",
      avatar: "I",
      content: "The voice recording feature with AI transcription is a game-changer for my research interviews. Absolutely incredible!",
      rating: 5,
      verified: true,
      imageUrl: '/testimonial3.jpg'
    },
    {
      name: "Dr. Effah Emmanuel",
      role: "Computer Science lecturer at UMaT",
      avatar: "DE",
      content: "Finally, an AI tool that actually understands my learning style. My productivity has increased by 300%!",
      rating: 5,
      verified: true,
      imageUrl: '/testimonial2.jpg'
    },
  ];

  const nextTestimonial = () => {
    setCurrentTestimonialIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIndex((prevIndex) =>
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
  };

  useEffect(() => {
    const autoPlayInterval = setInterval(nextTestimonial, 7000);
    const carouselElement = carouselRef.current;

    if (carouselElement) {
      const handleMouseEnter = () => clearInterval(autoPlayInterval);
      const handleMouseLeave = () => setInterval(nextTestimonial, 7000);

      carouselElement.addEventListener('mouseenter', handleMouseEnter);
      carouselElement.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        clearInterval(autoPlayInterval);
        carouselElement.removeEventListener('mouseenter', handleMouseEnter);
        carouselElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [currentTestimonialIndex, testimonials.length]);

  const features = [
    {
      icon: LayoutDashboard,
      title: "Smart Dashboard",
      description: "Visual overview of your learning curves. Track daily progress, recent activities, and upcoming tasks in one central hub.",
      color: "bg-blue-600"
    },
    {
      icon: MessageSquare,
      title: "AI Chat Assistant",
      description: "24/7 study companion. Ask questions, clarify doubts, and generate study guides based on your specific curriculum.",
      color: "bg-indigo-600"
    },
    {
      icon: FileText,
      title: "Intelligent Notes",
      description: "Next-gen editor with AI-powered autocompletion, formatting, and instant summarization of your thought process.",
      color: "bg-green-600"
    },
    {
      icon: Brain,
      title: "Document Analysis",
      description: "Turn static PDFs into interactive knowledge. Upload course materials and chat directly with your documents.",
      color: "bg-orange-600"
    },
    {
      icon: Mic,
      title: "Lecture Transcription",
      description: "Never miss a detail. Record lectures directly in the app and get accurate, searchable text transcripts automatically.",
      color: "bg-red-600"
    },
    {
      icon: Users,
      title: "Social Learning",
      description: "Connect with classmates, share notes, and form study groups to master subjects together.",
      color: "bg-purple-600"
    }
  ];

  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased overflow-x-hidden flex items-center justify-center">
        <video
          src="https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/video_2025-12-06_08-58-44.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30 dark:opacity-20 pointer-events-none"
          onError={(e) => console.error("Video load error:", e.currentTarget.error)}
        >
          Your browser does not support the video tag.
        </video>

        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/80 dark:from-black/30 dark:to-black/80 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center px-4 pt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <img
              src="/siteimage.png"
              alt="StuddyHub AI logo"
              className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6 object-contain drop-shadow-2xl filter"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100/90 backdrop-blur-sm text-blue-700 rounded-full text-sm font-semibold mb-6 shadow-sm dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
          >
            <Zap className="h-4 w-4" />
            <span>Intelligent Learning, Simplified</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 leading-tight text-gray-900 dark:text-white tracking-tight"
          >
            Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Academic Journey</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-lg md:text-2xl text-gray-700 dark:text-gray-200 mb-10 max-w-3xl mx-auto leading-relaxed font-medium"
          >
            Your intelligent companion for seamless learning, organization, and productivity.
            Elevate how you take notes, record ideas, and manage your academic life with cutting-edge AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row justify-center gap-4 mb-20"
          >
            <Link to="/auth">
              <Button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border-0 ring-4 ring-blue-500/20">
                Start Free Trial <ArrowRight className="h-6 w-6 ml-2" />
              </Button>
            </Link>
            <a href="https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/video_2025-12-06_08-58-44.mp4" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="px-8 py-4 border-2 border-gray-300/50 backdrop-blur-sm bg-white/50 dark:bg-gray-900/50 text-gray-800 font-bold text-xl rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all transform hover:scale-105 dark:border-gray-700 dark:text-gray-200">
                Watch Demo <Play className="h-6 w-6 ml-2" />
              </Button>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="flex flex-wrap justify-center items-center gap-6 md:gap-10 text-sm md:text-base text-gray-600 dark:text-gray-300 font-medium"
          >
            <div className="flex items-center gap-2 bg-white/60 dark:bg-black/40 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-gray-100 dark:border-gray-800">
              <Shield className="h-4 w-4 text-green-600" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2 bg-white/60 dark:bg-black/40 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-gray-100 dark:border-gray-800">
              <Globe className="h-4 w-4 text-blue-600" />
              <span>Global Community</span>
            </div>
            <div className="flex items-center gap-2 bg-white/60 dark:bg-black/40 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-gray-100 dark:border-gray-800">
              <Award className="h-4 w-4 text-yellow-600" />
              <span>Award-Winning Innovation</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <ContentContainer>
          {loadingStats ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-4 text-gray-600 dark:text-gray-400">Loading stats...</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, staggerChildren: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
            >
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Users className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.activeUsers}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Active Users</div>
              </div>
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-green-100 text-green-600 rounded-full mb-4 dark:bg-green-900/30 dark:text-green-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <FileText className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.notesProcessed}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Notes Processed</div>
              </div>
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-purple-100 text-purple-600 rounded-full mb-4 dark:bg-purple-900/30 dark:text-purple-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <TrendingUp className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.uptime}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Uptime</div>
              </div>
              <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-yellow-100 text-yellow-600 rounded-full mb-4 dark:bg-yellow-900/30 dark:text-yellow-400 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <Star className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.userRating}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">User Rating</div>
              </div>
            </motion.div>
          )}
        </ContentContainer>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-24 bg-gray-50/50 dark:bg-gray-950/50">
        <ContentContainer>
          <div className="text-center mb-16 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold shadow-sm dark:bg-blue-900/30 dark:text-blue-300"
            >
              <Zap className="h-4 w-4" />
              <span>Core Capabilities</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white"
            >
              Everything You Need to <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Thrive</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed"
            >
              Discover how our intelligent features can transform your learning experience and boost your productivity.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/50 hover:shadow-2xl hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all duration-300"
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 ${feature.color} bg-opacity-90 text-white rounded-2xl mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  {React.createElement(feature.icon, { className: "h-7 w-7" })}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </ContentContainer>
      </section>
      <section className="py-12 md:py-16 bg-blue-800/10 dark:bg-gray-900">
        <ContentContainer>
          <ScreenshotGallery
            screenshots={appScreenshots}
            title="Beautiful & Intuitive Interface"
            description="Experience our app in both light and dark modes"
            showThemeToggle={true}
          />
        </ContentContainer>
      </section>

      {/* Demo Video Section */}
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-950">
        <ContentContainer>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
              <Play className="h-4 w-4" />
              <span>See It In Action</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              Watch Our <span className="text-blue-600 dark:text-blue-400">Interactive Demo</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              See how StuddyHub AI transforms learning with intelligent note-taking, document analysis, and AI chat.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl border-4 border-white/20 dark:border-gray-800/20">
              <iframe
                src="https://app.supademo.com/embed/cmiuw8fc53q0ml821m200i3ra"
                className="absolute inset-0 w-full h-full"
                title="StuddyHub AI Demo"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            <div className="mt-6 text-center">
              <a
                href="https://app.supademo.com/demo/cmiuw8fc53q0ml821m200i3ra?utm_source=link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Open demo in full screen</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </div>
          </div>
        </ContentContainer>
      </section>
      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 md:py-24 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <ContentContainer>
          <div className="text-center mb-16 space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold shadow-sm dark:bg-yellow-900/30 dark:text-yellow-400"
            >
              <Star className="h-4 w-4 text-yellow-500" />
              <span>Trusted by Our Community</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white"
            >
              What Our <span className="text-blue-600 dark:text-blue-400">Users Say</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed"
            >
              Hear directly from students and professionals who are transforming their productivity with StuddyHub AI.
            </motion.p>
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-12">
            {/* Background Decorations for Immersiveness */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div ref={carouselRef} className="relative w-full overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div
                className="flex transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1)"
                style={{ transform: `translateX(-${currentTestimonialIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 p-8 md:p-12">
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                      <div className="flex-shrink-0">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-lg border-4 border-white dark:border-gray-700">
                          {testimonial.imageUrl ? (
                            <img src={testimonial.imageUrl} alt={`${testimonial.name}'s avatar`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                              {testimonial.avatar}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <div className="flex justify-center md:justify-start mb-3">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                          ))}
                        </div>
                        <blockquote className="text-xl md:text-2xl font-medium text-gray-800 dark:text-gray-200 leading-relaxed italic mb-6">
                          "{testimonial.content}"
                        </blockquote>
                        <div>
                          <div className="font-bold text-lg text-gray-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
                            {testimonial.name}
                            {testimonial.verified && (
                              <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="text-blue-600 dark:text-blue-400 font-medium">{testimonial.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 sm:-ml-5 bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110 transition-all z-10"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 sm:-mr-5 bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110 transition-all z-10"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>

            <div className="flex justify-center mt-8 gap-3">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonialIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${index === currentTestimonialIndex
                    ? 'bg-blue-600 dark:bg-blue-400 w-8'
                    : 'bg-gray-300 dark:bg-gray-600 w-2 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </ContentContainer>
      </section>

      {/* Call to Action Section */}
      <section id="cta" className="relative py-20 md:py-28 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 dark:from-blue-900 dark:to-gray-900" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl" />

        <ContentContainer className="relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-bold text-white tracking-tight"
            >
              Ready to <span className="text-yellow-300 inline-block transform hover:scale-105 transition-transform duration-300 cursor-default">Elevate</span> Your Learning?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto leading-relaxed"
            >
              Join thousands of students and professionals who've revolutionized their productivity with StuddyHub AI.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link to="/auth">
                <Button className="px-10 py-6 bg-white text-blue-700 hover:bg-gray-50 font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 border-0 ring-4 ring-blue-500/30">
                  Start Your Free Trial <ArrowRight className="h-6 w-6 ml-2" />
                </Button>
              </Link>
            </motion.div>
            <p className="text-sm text-blue-200 mt-4">No credit card required • 14-day free trial</p>
          </div>
        </ContentContainer>
      </section>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          whileHover={{
            scale: 1.1,
            y: -5,
            boxShadow: "0 20px 40px rgba(59, 130, 246, 0.4)"
          }}
          whileTap={{ scale: 0.95 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-4 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-2xl transition-all duration-300"
          style={{
            boxShadow: "0 10px 30px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset"
          }}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-6 w-6" />
        </motion.button>
      )}
    </AppLayout >
  );
};

export default LandingPage;