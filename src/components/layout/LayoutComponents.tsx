 // src/components/layout/AppLayout.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sun, Moon, Menu, X, LocateIcon, MapIcon, PhoneCallIcon, Download, Smartphone, CheckCircle, Loader2, LayoutDashboard, Settings, LogOut, ChevronDown, FileText, MessageSquare, Brain, Mic, Users, BookOpen, GraduationCap, HelpCircle, Newspaper, Code2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';

// ── Mega Nav Dropdown (hover-based for desktop) ──────────────────────────
const MegaNavDropdown: React.FC<{
  label: string;
  children: React.ReactNode;
  setIsMenuOpen?: (open: boolean) => void;
}> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  // Also close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          open
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/20'
            : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
        }`}
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl ring-1 ring-gray-200/70 dark:ring-gray-800 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {/* Arrow */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-900 rotate-45 border-l border-t border-gray-200/70 dark:border-gray-800 rounded-tl-sm" />
          <div className="relative">{children}</div>
        </div>
      )}
    </div>
  );
};

// Header component extracted from LandingPage
export const AppHeader: React.FC<{
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}> = ({ isDarkMode, toggleDarkMode, isMenuOpen, setIsMenuOpen }) => {
  const [scrollY, setScrollY] = React.useState(0);
  const navigate = useNavigate();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Auth-aware state: show user info when logged in
  const [authUser, setAuthUser] = useState<{ fullName: string; avatarUrl: string | null } | null>(null);
  // Avatar dropdown state
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target as Node)) {
        setIsAvatarDropdownOpen(false);
      }
    };
    if (isAvatarDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarDropdownOpen]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !mounted) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (mounted) {
          setAuthUser({
            fullName: profile?.full_name || session.user.email?.split('@')[0] || 'User',
            avatarUrl: profile?.avatar_url || null,
          });
        }
      } catch {
        // Not logged in or profile fetch failed — stay in guest mode
      }
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (mounted) setAuthUser(null);
      } else {
        loadUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if PWA is already installed
  useEffect(() => {
    const checkPWAInstall = () => {
      // Check if running in standalone mode (installed PWA)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsPwaInstalled(true);
      }

      // TypeScript-safe check for iOS standalone mode
      const nav = window.navigator as any;
      if (nav.standalone === true) {
        setIsPwaInstalled(true);
      }
    };

    checkPWAInstall();
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();

      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setShowInstallPrompt(true);

      // Show notification
      if (!sessionStorage.getItem('install-toast-shown')) {
        toast.info('Install StuddyHub as a mobile app for better experience!', {
          duration: 5000,
        });
        sessionStorage.setItem('install-toast-shown', 'true');
      }
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      toast.success('StuddyHub installed successfully! 🎉');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle Web App installation
  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Show instructions for manual installation
      showInstallInstructions();
      return;
    }

    // Prevent multiple clicks
    if (isInstalling) {
      toast.info('Installation in progress...');
      return;
    }

    setIsInstalling(true);
    setShowInstallPrompt(false);

    try {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('🎉 StuddyHub installed successfully!');
        setIsPwaInstalled(true);
        setDeferredPrompt(null);
      } else {
        toast.info('Installation cancelled. You can install later from the menu.');
        setTimeout(() => setShowInstallPrompt(true), 3000);
      }
    } catch (error) {
      // console.error('Error installing app:', error);
      toast.error('Failed to install app. Please try manual installation.');
      showInstallInstructions();
      setTimeout(() => setShowInstallPrompt(true), 3000);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  // Show installation instructions
  const showInstallInstructions = () => {
    toast(
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h3 className="font-bold text-lg mb-2">Install StuddyHub on Mobile</h3>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-500" />
            <strong>iOS (Safari):</strong> Tap Share → Add to Home Screen
          </p>
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-green-500" />
            <strong>Android (Chrome):</strong> Tap Menu → Install App
          </p>
        </div>
        <Button
          onClick={() => window.open('https://studdyhub.vercel.app/install-guide', '_blank')}
          className="w-full mt-3"
        >
          View Detailed Guide
        </Button>
      </div>,
      {
        duration: 10000,
        position: 'bottom-center',
      }
    );
  };

  // Check if device is mobile
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Install App Button Component
  const InstallAppButton = () => {
    if (isPwaInstalled) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="hidden md:inline-flex bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-200 dark:border-emerald-800 text-green-700 dark:text-emerald-200 rounded-full cursor-default"
          disabled
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Installed
        </Button>
      );
    }

    if (!showInstallPrompt) return null;

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallApp}
        disabled={isInstalling}
        className={`hidden md:inline-flex rounded-full transition-all duration-300 ${isInstalling
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95'
          } bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-200 dark:border-indigo-800 hover:from-indigo-500/20 hover:to-blue-500/20 text-indigo-700 dark:text-indigo-200`}
      >
        {isInstalling ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Installing...
          </>
        ) : isMobileDevice() ? (
          <>
            <Smartphone className="h-4 w-4 mr-2" />
            Add to Home
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Install App
          </>
        )}
      </Button>
    );
  };

  return (
    <header className={`fixed top-0 left-0 w-full px-4 md:px-8 py-4 flex justify-between items-center z-50 transition-all duration-300 ${scrollY > 50
      ? 'bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md'
      : 'bg-transparent'
      }`}>
      {/* Site Icon and Name - Linked to home */}
      <Link to="/" className="flex items-center gap-3 group">
        <img
          src="/siteimage.png"
          alt="studdyhub AI Logo"
          className="h-12 w-12 md:h-14 md:w-14 object-contain group-hover:scale-110 transition-transform"
        />
        <div className="flex flex-row">
          <span className="text-2xl md:text-3xl font-bold text-blue-700/95 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            StuddyHub
          </span>
          <span className="text-2xl mx-2 md:text-3xl font-bold text-red-600/65 font-claude">AI</span>
        </div>
      </Link>

      {/* Desktop Navigation — Mega Nav */}
      <nav className="hidden md:flex items-center gap-1">
        <InstallAppButton />

        {/* Features mega dropdown */}
        <MegaNavDropdown label="Features" setIsMenuOpen={setIsMenuOpen}>
          <div className="grid grid-cols-2 gap-1 p-4 w-[520px]">
            {[
              { icon: LayoutDashboard, title: 'Smart Dashboard', desc: 'Track study streaks & AI insights', href: '/#features' },
              { icon: MessageSquare, title: 'AI Chat Assistant', desc: '24/7 AI-powered study companion', href: '/#features' },
              { icon: FileText, title: 'Intelligent Notes', desc: 'AI summarisation & organisation', href: '/#features' },
              { icon: Brain, title: 'Document Analysis', desc: 'Upload & chat with your docs', href: '/#features' },
              { icon: Mic, title: 'Podcasts & Recordings', desc: 'Record, transcribe & study', href: '/#features' },
              { icon: Users, title: 'Social & Study Groups', desc: 'Collaborate with classmates', href: '/#features' },
            ].map((item) => (
              <a key={item.title} href={item.href} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group">
                <div className="mt-0.5 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <item.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50/60 dark:bg-gray-800/40 rounded-b-xl">
            <a href="/#features" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              View all features <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
            </a>
          </div>
        </MegaNavDropdown>

        {/* Resources mega dropdown */}
        <MegaNavDropdown label="Resources" setIsMenuOpen={setIsMenuOpen}>
          <div className="grid grid-cols-2 gap-1 p-4 w-[440px]">
            {[
              { icon: BookOpen, title: 'Documentation', desc: 'Guides & API reference', to: '/documentation-page' },
              { icon: HelpCircle, title: 'User Guide', desc: 'Step-by-step tutorials', to: '/user-guide-page' },
              { icon: Newspaper, title: 'Blog', desc: 'Tips, updates & stories', to: '/blogs' },
              { icon: Code2, title: 'API', desc: 'Integrate with StuddyHub', to: '/api' },
              { icon: Briefcase, title: 'Careers', desc: 'Join our team', to: '/careers' },
              { icon: GraduationCap, title: 'Integrations', desc: 'Tools & extensions', to: '/integrations' },
            ].map((item) => (
              <Link key={item.title} to={item.to} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group">
                <div className="mt-0.5 w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <item.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </MegaNavDropdown>

        <Link to="/pricing" className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40">
          Pricing
        </Link>
        <Link to="/about-us" className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40">
          About
        </Link>
        <Link to="/contact" className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40">
          Contact
        </Link>
        {authUser ? (
          <div className="relative" ref={avatarDropdownRef}>
            <button
              onClick={() => setIsAvatarDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 hover:opacity-90 transition-opacity"
              aria-label="User menu"
              aria-expanded={isAvatarDropdownOpen}
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden ring-2 ring-white dark:ring-gray-800">
                {authUser.avatarUrl ? (
                  <img src={authUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{authUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isAvatarDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isAvatarDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User info */}
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{authUser.fullName}</p>
                </div>
                {/* Menu items */}
                <button
                  onClick={() => { setIsAvatarDropdownOpen(false); navigate('/dashboard'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => { setIsAvatarDropdownOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={async () => { setIsAvatarDropdownOpen(false); await supabase.auth.signOut(); navigate('/'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => navigate('/auth')}
            className="px-5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Sign In
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleDarkMode}
          className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </nav>

      {/* Mobile Menu Button - Touch targets min 44x44px for WCAG compliance */}
      <div className="flex items-center md:hidden gap-1">
        {showInstallPrompt && !isPwaInstalled && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleInstallApp}
            disabled={isInstalling}
            className="rounded-full min-w-[44px] min-h-[44px] w-11 h-11"
            aria-label="Install app"
          >
            {isInstalling ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-w-[44px] min-h-[44px] w-11 h-11 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-900 shadow-lg md:hidden">
          <nav className="flex flex-col gap-1 p-6">
            {/* Install App in Mobile Menu */}
            {showInstallPrompt && !isPwaInstalled && (
              <Button
                onClick={() => {
                  handleInstallApp();
                  setIsMenuOpen(false);
                }}
                disabled={isInstalling}
                className="w-full mb-2 min-h-[44px]"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-5 w-5 mr-2" />
                    Install App
                  </>
                )}
              </Button>
            )}

            <a
              href="/#features"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <Link
              to="/documentation-page"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Documentation
            </Link>
            <Link
              to="/user-guide-page"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              User Guide
            </Link>
            <Link
              to="/blogs"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              to="/pricing"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/about-us"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="min-h-[44px] flex items-center px-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <hr className="border-gray-200 dark:border-gray-700" />
            {authUser ? (
              <>
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden ring-2 ring-white dark:ring-gray-800 flex-shrink-0">
                    {authUser.avatarUrl ? (
                      <img src={authUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{authUser.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                    )}
                  </div>
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{authUser.fullName}</span>
                </div>
                <Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/settings" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full mt-2 flex items-center justify-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="w-full mt-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2"
                  onClick={async () => { setIsMenuOpen(false); await supabase.auth.signOut(); navigate('/'); }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

// Footer component from improved design
export const AppFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/siteimage.png"
                alt="studdyhub AI Logo"
                className="h-12 w-12 object-contain group-hover:scale-110 transition-transform"
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">StuddyHub AI</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Intelligent Learning Platform</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Empowering students and professionals with AI-powered tools for notes, recordings, and schedules.
              Based at the University of Mines and Technology, Tarkwa, Ghana.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-green-700"><MapIcon /></span>
              <span>Agri-IoT Lab, UMaT, Tarkwa, Ghana</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
              <span className="font-medium text-blue-700"><PhoneCallIcon /></span>
              <span>027 169 2568</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Product</h4>
            <ul className="space-y-1">
              <li><a href="/#features" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
              <li><Link to="/documentation-page" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</Link></li>
              <li><Link to="/user-guide-page" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">User Guide</Link></li>
              <li><Link to="/api" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">API Reference</Link></li>
              <li><Link to="/pricing" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-1">
              <li><Link to="/about-us" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link to="/blogs" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="inline-flex items-center min-h-[44px] text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-300 dark:border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              &copy; {currentYear} StuddyHub AI. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy-policy" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main App Layout Component
export const AppLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  React.useEffect(() => {
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased overflow-x-hidden">
      <AppHeader
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      <main className="pt-16">
        {children}
      </main>
      <AppFooter />
    </div>
  );
};

// Content Container for consistent spacing
export const ContentContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`container mx-auto px-4 md:px-8 py-12 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {children}
      </div>
    </div>
  );
};

// Page Header Component
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  description?: string;
}> = ({ title, subtitle, description }) => {
  return (
    <div className="text-center mb-12 md:mb-16">
      {subtitle && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium mb-4">
          {subtitle}
        </div>
      )}
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
        {title}
      </h1>
      {description && (
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  );
};

// Full-width hero banner inspired by professional agency designs
export const PageHero: React.FC<{
  title: string;
  subtitle?: string;
  description?: string;
  gradient?: string;
}> = ({ title, subtitle, description, gradient = 'from-blue-600 via-blue-700 to-indigo-800' }) => {
  return (
    <div className={`relative bg-gradient-to-br ${gradient} -mx-4 md:-mx-8 -mt-12 mb-12 md:mb-16 overflow-hidden`}>
      {/* Decorative shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />
      </div>
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }} />

      <div className="relative container mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
        {subtitle && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 rounded-full text-sm font-medium mb-5 tracking-wide uppercase">
            {subtitle}
          </div>
        )}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight drop-shadow-sm">
          {title}
        </h1>
        {description && (
          <p className="text-lg md:text-xl text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

// Centered section heading with optional underline accent
export const SectionHeading: React.FC<{
  title: string;
  description?: string;
  centered?: boolean;
}> = ({ title, description, centered = true }) => {
  return (
    <div className={`mb-10 ${centered ? 'text-center' : ''}`}>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
      <div className={`w-12 h-1 bg-blue-600 rounded-full mb-4 ${centered ? 'mx-auto' : ''}`} />
      {description && (
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">{description}</p>
      )}
    </div>
  );
};

// Card Component
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow ${className}`}>
      {children}
    </div>
  );
};

/**
 * ThemedImg — renders a light-mode image and its dark-mode counterpart.
 *
 * Pass only the `-light.jpg` path as `src` and the component will automatically
 * derive the dark variant by replacing `-light.` with `-dark.`.
 * Override with explicit `darkSrc` if the naming convention differs.
 *
 * Uses Tailwind's `dark:hidden` / `hidden dark:block` so it's zero-JS.
 */
export const ThemedImg: React.FC<{
  src: string;
  darkSrc?: string;
  alt: string;
  className?: string;
}> = ({ src, darkSrc, alt, className = '' }) => {
  const dark = darkSrc || src.replace('-light.', '-dark.');
  return (
    <>
      <img src={src}  alt={alt} className={`dark:hidden ${className}`} />
      <img src={dark} alt={alt} className={`hidden dark:block ${className}`} />
    </>
  );
};
