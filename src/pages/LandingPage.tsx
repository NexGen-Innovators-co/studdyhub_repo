// src/pages/LandingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, ArrowRight, Play, Shield, Globe, Award, Users, FileText, TrendingUp, Star, Zap, Menu, X, ChevronLeft, ChevronRight, Sun, Moon, Loader2 } from 'lucide-react';

// Supabase Import (for stats)
import { supabase } from '../integrations/supabase/client';

const LandingPage: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0); // For auto-rotating features
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0); // For testimonial carousel
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize dark mode from localStorage or system preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // State for App Stats
  const [appStats, setAppStats] = useState({
    activeUsers: '0+',
    notesProcessed: '0+',
    uptime: '0%',
    userRating: '0/5',
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const carouselRef = useRef<HTMLDivElement>(null); // Ref for testimonial carousel container

  useEffect(() => {
    setIsVisible(true); // Trigger initial fade-in for hero content

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    // Auto-rotate features every 4 seconds
    const featureInterval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(featureInterval);
    };
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
            .insert([defaultStats])


          if (insertError) {
            console.error("Error inserting default app stats:", insertError);
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
          console.error("Error fetching app stats from Supabase:", error);
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
        console.error("Unexpected error fetching app stats:", error);
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

  // Effect to apply/remove 'dark' class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  // Testimonial carousel navigation
  const testimonials = [
    {
      name: "Doris",
      role: "SHS student",
      avatar: "D",
      content: "studdyhub AI has completely revolutionized how I study. The AI chat is incredibly helpful, and the document analysis saves me so much time!",
      rating: 5,
      verified: true,
      imageUrl: "/testimonial1.jpg" // Added for the first testimonial
    },
    {
      name: "Isabel",
      role: "A computer science student at UMaT",
      avatar: "I",
      content: "The voice recording feature with AI transcription is a game-changer for my research interviews. Absolutely incredible!",
      rating: 5,
      verified: true,
      imageUrl: "/testimonial3.jpg" // Added for the second testimonial
    },
    {
      name: "Dr. Effah Emmanuel",
      role: "A computer science lecturer at UMaT",
      avatar: "DE",
      content: "Finally, an AI tool that actually understands my learning style. My productivity has increased by 300%!",
      rating: 5,
      verified: true,
      imageUrl: "/testimonial2.jpg" // Updated for the third testimonial
    }
  ];

  const nextTestimonial = () => {
    setCurrentTestimonialIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIndex((prevIndex) =>
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
  };

  // Auto-play for testimonials
  useEffect(() => {
    const autoPlayInterval = setInterval(nextTestimonial, 7000); // Change testimonial every 7 seconds

    const carouselElement = carouselRef.current;
    if (carouselElement) {
      const handleMouseEnter = () => clearInterval(autoPlayInterval);
      const handleMouseLeave = () => {
        clearInterval(autoPlayInterval); // Clear existing to prevent multiple intervals
        // Re-establish the interval only if it was cleared by mouseEnter
        const newInterval = setInterval(nextTestimonial, 7000);
        return () => clearInterval(newInterval); // Cleanup on unmount or re-render
      };

      carouselElement.addEventListener('mouseenter', handleMouseEnter);
      carouselElement.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        clearInterval(autoPlayInterval);
        carouselElement.removeEventListener('mouseenter', handleMouseEnter);
        carouselElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [currentTestimonialIndex, testimonials.length]);

  // Define features with a new, consistent color scheme
  const features = [
    {
      icon: Users, // Changed from BookOpen to Users for diversity
      title: "Intelligent Note-Taking",
      description: "Automatically summarize, organize, and extract key insights from your notes. Ask questions and get instant answers based on your content.",
      color: "bg-blue-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    },
    {
      icon: FileText, // Changed from Mic to FileText for diversity
      title: "Effortless Recording Analysis",
      description: "Transcribe lectures, meetings, and discussions. AI identifies key topics, speakers, and creates actionable summaries.",
      color: "bg-green-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    },
    {
      icon: Award, // Changed from Calendar to Award for diversity
      title: "Optimized Scheduling",
      description: "Manage your academic and personal schedule with AI assistance. Get smart reminders and optimize your time.",
      color: "bg-indigo-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    },
    {
      icon: Zap, // Changed from MessageCircle to Zap for diversity
      title: "Contextual AI Chat",
      description: "Engage in natural conversations with an AI assistant that understands your context from notes and documents.",
      color: "bg-orange-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    },
    {
      icon: Shield, // Changed from FileText to Shield for diversity
      title: "Smart Document Insights",
      description: "Upload and analyze various document types. The AI extracts key information and makes it searchable and usable.",
      color: "bg-red-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    },
    {
      icon: Globe, // Changed from Brain to Globe for diversity
      title: "Personalized Learning Paths",
      description: "Customize AI responses to match your unique learning style (visual, auditory, kinesthetic, reading/writing).",
      color: "bg-purple-600",
      bgColor: "bg-white",
      darkBgColor: "dark:bg-gray-800"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased overflow-x-hidden">

      {/* Header */}
      <header className={`fixed w-full px-6 py-4 flex justify-between items-center z-50 transition-all duration-300 ${scrollY > 50
        ? 'bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md'
        : 'bg-transparent'
        }`}>
        {/* Site Icon and Name - Linked to home */}
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/siteimage.png"
            alt="studdyhub AI Logo"
            className="h-14 w-14 object-contain group-hover:scale-110 transition-transform"
          />
          <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">studdyhub AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">Features</a>
          <a href="#testimonials" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">Testimonials</a>
          <a href="#cta" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">Pricing</a>
          <Link to="/auth">
            <Button type="button" className="px-5 py-2 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button type="button" className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">Get Started</Button>
          </Link>
          {/* Dark Mode Toggle for Desktop */}
          <Button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center md:hidden gap-2">
          {/* Dark Mode Toggle for Mobile */}
          <Button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-900 shadow-lg md:hidden">
            <nav className="flex flex-col gap-4 p-6">
              <a href="#features" className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>Features</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>Testimonials</a>
              <a href="#cta" className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium" onClick={() => setIsMenuOpen(false)}>Pricing</a>
              <hr className="border-gray-200 dark:border-gray-700" />
              <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                <Button type="button" className="w-full text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors justify-start">Sign In</Button>
              </Link>
              <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                <Button type="button" className="w-full bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">Get Started</Button>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-gray-50 dark:bg-gray-950 overflow-hidden">
        {/* Video Background */}
        <video
          src="/videoDemo.mp4"
          autoPlay
          loop
          muted
          playsInline // Important for mobile autoplay
          className="absolute inset-0 w-full h-full object-cover opacity-30 dark:opacity-20 pointer-events-none"
          onError={(e) => console.error("Video load error:", e.currentTarget.error)}
        >
          Your browser does not support the video tag. Please download the video to view it:
          <a href="/videoDemo.mp4" download>Download Video</a>
        </video>

        {/* Subtle background pattern (keep if desired, adjust opacity/color if needed) */}
        <div className="absolute inset-0 opacity-10 dark:opacity-5">
          <svg className="w-full h-full" fill="none" viewBox="0 0 100 100">
            <defs>
              <pattern id="pattern-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 L 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-gray-200 dark:text-gray-800" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-grid)" />
          </svg>
        </div>

        <div className={`relative z-10 max-w-5xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          {/* Site Image in Hero Section */}
          <img
            src="/siteimage.png"
            alt="studdyhub AI logo or main illustration"
            className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6 object-contain rounded-full shadow-lg"
          />

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
            <Zap className="h-4 w-4" />
            <span>Intelligent Learning, Simplified</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight text-gray-900 dark:text-white">
            Transform Your <span className="text-blue-600 dark:text-blue-400">Academic Journey</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            Your intelligent companion for seamless learning, organization, and productivity.
            Elevate how you take notes, record ideas, and manage your academic life with cutting-edge AI.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link to="/auth">
              <Button type="button" className="px-8 py-3 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-xl hover:bg-blue-700 transition-colors transform hover:scale-105">
                Start Free Trial <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            {/* Watch Demo Button */}
            <a href="/videoDemo.mp4" target="_blank" rel="noopener noreferrer">
              <Button type="button" className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-bold text-lg rounded-lg hover:bg-gray-100 transition-colors transform hover:scale-105 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                Watch Demo <Play className="h-5 w-5 ml-2" />
              </Button>
            </a>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              <span>Global Community</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-600" />
              <span>Award-Winning Innovation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-white dark:bg-gray-900 shadow-inner">
        <div className="max-w-6xl mx-auto">
          {loadingStats ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-4 text-gray-600 dark:text-gray-400">Loading stats...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <Users className="h-7 w-7" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">{appStats.activeUsers}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Active Users</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-7 w-7" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">{appStats.notesProcessed}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Notes Processed</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <TrendingUp className="h-7 w-7" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">{appStats.uptime}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Uptime</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <Star className="h-7 w-7" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">{appStats.userRating}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">User Rating</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-24 px-6 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
              <Zap className="h-4 w-4" />
              <span>Core Capabilities</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-gray-900 dark:text-white">
              Everything You Need to <span className="text-blue-600 dark:text-blue-400">Thrive</span>
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Discover how our intelligent features can transform your learning experience and boost your productivity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-8 rounded-xl shadow-md border border-gray-200 dark:border-gray-800 ${feature.bgColor} ${feature.darkBgColor} hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 transform hover:-translate-y-1 ${activeFeature === index ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 ${feature.color} text-white rounded-full mb-6 shadow-md`}>
                  {React.createElement(feature.icon, { className: "h-8 w-8" })}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section with Carousel */}
      <section id="testimonials" className="py-20 md:py-24 px-6 bg-white dark:bg-gray-900 relative">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>Trusted by Our Community</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-gray-900 dark:text-white">
            What Our <span className="text-blue-600 dark:text-blue-400">Users Say</span>
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            Hear directly from students and professionals who are transforming their productivity with studdyhub AI.
          </p>

          {/* Carousel Container */}
          <div ref={carouselRef} className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-xl">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentTestimonialIndex * 100}%)` }}
            >
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="w-full flex-shrink-0 p-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center mb-6">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full overflow-hidden mr-4">
                      {testimonial.imageUrl ? (
                        <img src={testimonial.imageUrl} alt={`${testimonial.name}'s avatar`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                          {testimonial.avatar}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {testimonial.name}
                        {testimonial.verified && (
                          <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-sm">{testimonial.role}</div>
                    </div>
                  </div>
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <svg className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.111A8.85 8.85 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    "{testimonial.content}"
                  </p>
                </div>
              ))}
            </div>

            {/* Carousel Navigation Buttons */}
            <Button
              type="button"
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 p-2 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors z-10 ml-4"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </Button>
            <Button
              type="button"
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 p-2 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors z-10 mr-4"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </Button>

            {/* Pagination Dots */}
            <div className="flex justify-center mt-8 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonialIndex(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentTestimonialIndex ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                ></button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="cta" className="py-20 md:py-24 px-6 bg-blue-600 dark:bg-blue-900 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6">
            Ready to <span className="text-yellow-300">Elevate</span> Your Learning?
          </h2>
          <p className="text-lg md:text-xl opacity-90 mb-10">
            Join thousands of students and professionals who've revolutionized their productivity with studdyhub AI.
          </p>
          <Link to="/auth">
            <Button type="button" className="px-10 py-4 bg-white text-blue-600 font-bold text-xl rounded-lg shadow-xl hover:bg-gray-100 transition-colors transform hover:scale-105">
              Start Your Free Trial <ArrowRight className="h-6 w-6 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 bg-gray-800 dark:bg-black text-gray-300">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/siteimage.png"
                alt="studdyhub AI Logo"
                className="h-12 w-12 object-contain group-hover:scale-110 transition-transform"
              />
              <span className="text-2xl font-extrabold text-white">studdyhub AI</span>
            </div>
            <p className="text-gray-400 leading-relaxed mb-6">
              Empowering students and professionals to achieve more with intelligent tools for notes, recordings, and schedules.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Globe className="h-5 w-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                <img
                  src="/siteimage.png"
                  alt="studdyhub AI Logo"
                  className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-3 text-gray-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#cta" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="api" className="hover:text-white transition-colors">API</a></li>
              <li><a href="integrations" className="hover:text-white transition-colors">Integrations</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-3 text-gray-400">
              <li><a href="/about-us" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="/blogs" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="careers" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8 mt-12 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} studdyhub AI. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Custom CSS for animations (kept minimal and subtle) */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }

        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;