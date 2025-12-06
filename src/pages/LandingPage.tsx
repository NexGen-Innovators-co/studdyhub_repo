// src/pages/LandingPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, ArrowRight, Play, Shield, Globe, Award, Users, FileText, TrendingUp, Star, Zap, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { AppLayout, ContentContainer } from '../components/layout/LayoutComponents'
// Update src/pages/LandingPage.tsx - Add this after features section
import { ScreenshotGallery } from '../components/layout/ScreenshotGallery';
// Add these screenshots data (you'll replace with your actual screenshots)
// Update in src/pages/LandingPage.tsx
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
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [appStats, setAppStats] = useState({
    activeUsers: '0+',
    notesProcessed: '0+',
    uptime: '0%',
    userRating: '0/5',
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
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
      imageUrl: "/testimonial3.jpg"
    },
    {
      name: "Dr. Effah Emmanuel",
      role: "Computer Science lecturer at UMaT",
      avatar: "DE",
      content: "Finally, an AI tool that actually understands my learning style. My productivity has increased by 300%!",
      rating: 5,
      verified: true,
      imageUrl: "/testimonial2.jpg"
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
      icon: Users,
      title: "Intelligent Note-Taking",
      description: "Automatically summarize, organize, and extract key insights from your notes. Ask questions and get instant answers based on your content.",
      color: "bg-blue-600"
    },
    {
      icon: FileText,
      title: "Effortless Recording Analysis",
      description: "Transcribe lectures, meetings, and discussions. AI identifies key topics, speakers, and creates actionable summaries.",
      color: "bg-green-600"
    },
    {
      icon: Award,
      title: "Optimized Scheduling",
      description: "Manage your academic and personal schedule with AI assistance. Get smart reminders and optimize your time.",
      color: "bg-indigo-600"
    },
    {
      icon: Zap,
      title: "Contextual AI Chat",
      description: "Engage in natural conversations with an AI assistant that understands your context from notes and documents.",
      color: "bg-orange-600"
    },
    {
      icon: Shield,
      title: "Smart Document Insights",
      description: "Upload and analyze various document types. The AI extracts key information and makes it searchable and usable.",
      color: "bg-red-600"
    },
    {
      icon: Globe,
      title: "Personalized Learning Paths",
      description: "Customize AI responses to match your unique learning style (visual, auditory, kinesthetic, reading/writing).",
      color: "bg-blue-600"
    }
  ];

  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased overflow-x-hidden">
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

        <div className={`relative z-10 max-w-5xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}>
          <img
            src="/siteimage.png"
            alt="StuddyHub AI logo"
            className="w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6 object-contain"
          />

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
            <Zap className="h-4 w-4" />
            <span>Intelligent Learning, Simplified</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-gray-900 dark:text-white">
            Transform Your <span className="text-blue-600 dark:text-blue-400">Academic Journey</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            Your intelligent companion for seamless learning, organization, and productivity.
            Elevate how you take notes, record ideas, and manage your academic life with cutting-edge AI.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link to="/auth">
              <Button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
                Start Free Trial <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <a href="https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/video_2025-12-06_08-58-44.mp4" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-bold text-lg rounded-lg hover:bg-gray-100 transition-all transform hover:scale-105 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                Watch Demo <Play className="h-5 w-5 ml-2" />
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 text-sm text-gray-600 dark:text-gray-400">
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
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <ContentContainer>
          {loadingStats ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-4 text-gray-600 dark:text-gray-400">Loading stats...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <Users className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.activeUsers}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Active Users</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.notesProcessed}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Notes Processed</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <TrendingUp className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.uptime}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">Uptime</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-blue-100 text-blue-600 rounded-full mb-4 dark:bg-blue-900/30 dark:text-blue-400">
                  <Star className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">{appStats.userRating}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">User Rating</div>
              </div>
            </div>
          )}
        </ContentContainer>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 md:py-16 bg-gray-50 dark:bg-gray-950">
        <ContentContainer>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
              <Zap className="h-4 w-4" />
              <span>Core Capabilities</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              Everything You Need to <span className="text-blue-600 dark:text-blue-400">Thrive</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Discover how our intelligent features can transform your learning experience and boost your productivity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 transform hover:-translate-y-1"
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 ${feature.color} text-white rounded-full mb-4 shadow-md`}>
                  {React.createElement(feature.icon, { className: "h-7 w-7" })}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
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
      {/* Testimonials Section */}
      <section id="testimonials" className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <ContentContainer>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4 shadow-sm dark:bg-blue-900/30 dark:text-blue-300">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>Trusted by Our Community</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              What Our <span className="text-blue-600 dark:text-blue-400">Users Say</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Hear directly from students and professionals who are transforming their productivity with StuddyHub AI.
            </p>
          </div>

          <div ref={carouselRef} className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-xl">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentTestimonialIndex * 100}%)` }}
            >
              {testimonials.map((testimonial, index) => (
                <div key={index} className="w-full flex-shrink-0 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center mb-6">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden mr-4">
                      {testimonial.imageUrl ? (
                        <img src={testimonial.imageUrl} alt={`${testimonial.name}'s avatar`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white font-bold">
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
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    "{testimonial.content}"
                  </p>
                </div>
              ))}
            </div>

            <Button
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 p-2 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors z-10 ml-4"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
            <Button
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 p-2 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors z-10 mr-4"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>

            <div className="flex justify-center mt-6 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonialIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentTestimonialIndex
                    ? 'bg-blue-600 dark:bg-blue-400 w-4'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </ContentContainer>
      </section>

      {/* Call to Action Section */}
      <section id="cta" className="py-12 md:py-16 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 text-white">
        <ContentContainer>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to <span className="text-yellow-300">Elevate</span> Your Learning?
            </h2>
            <p className="text-lg md:text-xl opacity-90 mb-8">
              Join thousands of students and professionals who've revolutionized their productivity with StuddyHub AI.
            </p>
            <Link to="/auth">
              <Button className="px-8 py-3 bg-white text-blue-600 hover:bg-gray-100 font-bold text-lg rounded-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
                Start Your Free Trial <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </ContentContainer>
      </section>
    </AppLayout>
  );
};

export default LandingPage;