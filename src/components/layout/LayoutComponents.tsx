// src/components/layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Sun, Moon, Menu, X, LocateIcon, MapIcon, PhoneCallIcon, Download, Smartphone, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-4">
        <InstallAppButton />

        <a href="/#features" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">
          Features
        </a>
        <Link to="/documentation-page" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">
          Docs
        </Link>
        <Link to="/pricing" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">
          Pricing
        </Link>
        <Link to="/about-us" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">
          About
        </Link>
        <Link to="/contact" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium">
          Contact
        </Link>
        <Button
          onClick={() => navigate('/auth')}
          className="px-5 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Sign In
        </Button>
        <Button
          variant="outline"
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </nav>

      {/* Mobile Menu Button */}
      <div className="flex items-center md:hidden gap-2">
        {showInstallPrompt && !isPwaInstalled && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstallApp}
            disabled={isInstalling}
            className="rounded-full"
          >
            {isInstalling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-900 shadow-lg md:hidden">
          <nav className="flex flex-col gap-4 p-6">
            {/* Install App in Mobile Menu */}
            {showInstallPrompt && !isPwaInstalled && (
              <Button
                onClick={() => {
                  handleInstallApp();
                  setIsMenuOpen(false);
                }}
                disabled={isInstalling}
                className="w-full mb-2"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-2" />
                    Install App
                  </>
                )}
              </Button>
            )}

            <a
              href="/#features"
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <Link
              to="/documentation-page"
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Documentation
            </Link>
            <Link
              to="/pricing"
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/about-us"
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <hr className="border-gray-200 dark:border-gray-700" />
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
            <ul className="space-y-3">
              <li><a href="/#features" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
              <li><Link to="/documentation-page" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Documentation</Link></li>
              <li><Link to="/user-guide-page" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">User Guide</Link></li>
              <li><Link to="/api" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">API Reference</Link></li>
              <li><Link to="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link to="/about-us" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link to="/blogs" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</Link></li>
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
      {children}
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
