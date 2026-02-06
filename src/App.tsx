// App.tsx - Updated with simpler SEO approach
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { AdminAuthProvider } from "./hooks/useAdminAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AboutUs from "./pages/AboutUs";
import Contact from "./pages/ContactUs";
import Blog from "./pages/Blogs";
import Integrations from "./pages/Integrations";
import TermsOfService from "./pages/TermsOfServices";
import Careers from "./pages/Careers";
import APIPage from "./pages/APIs";
import DocumentationPage from "./pages/DocumentationPage";
import UserGuidePage from "./pages/UserGuide";
import React, { Suspense, lazy } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from "./contexts/AppContext";
import { AdminLayout } from "./components/admin/AdminLayout";
import { HelmetProvider } from "react-helmet-async";
import DynamicHead from "./components/seo/DynamicHead";
import { SubscriptionPage } from "./components/subscription";
import { AnimatePresence, motion } from "framer-motion";
import { OfflineIndicator } from "./components/layout/OfflineIndicator";
import CalendarCallback from "./pages/CalendarCallback";

// Lazy load admin components
const AdminDashboard = lazy(() => import("./components/admin/adminDashboard"));
const UserManagement = lazy(() => import("./components/admin/UserManagement"));
const AdminManagement = lazy(() => import("./components/admin/AdminManagement"));
const ContentModeration = lazy(() => import("./components/admin/ContentModeration"));
const SystemSettings = lazy(() => import("./components/admin/SystemSettings"));
const ActivityLogs = lazy(() => import("./components/admin/ActivityLogs"));
const CourseManagement = lazy(() => import("./components/admin/CourseManagement"));

const queryClient = new QueryClient();

const Fallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-950">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Create a wrapper component for SEO
const AppWithSEO = () => {
  const location = useLocation();

  // Determine transition key to group dashboard routes
  const getPageKey = (pathname: string) => {
    // List of prefixes that render the main App Shell (Index.tsx)
    const appShellRoutes = [
      '/dashboard', '/notes', '/note', '/recordings', '/schedule',
      '/chat', '/documents', '/settings', '/quizzes', '/library',
      '/podcasts', '/social'
    ];
    
    // Check if current path matches any app shell route
    const isAppShell = appShellRoutes.some(route => pathname.startsWith(route));
    
    // Return a constant key for all app shell routes to prevent full page transition
    // when switching tabs inside the app
    if (isAppShell) return 'app-shell';
    
    // Otherwise return the pathname for standard page transitions
    return pathname;
  };

  return (
    <>
      <DynamicHead pathname={location.pathname} />
      <Suspense fallback={<Fallback />}>
        <Routes location={location}>
          {/* ==== PUBLIC ROUTES ==== */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blogs" element={<Blog />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/api" element={<APIPage />} />
          <Route path="/documentation-page" element={<DocumentationPage />} />
          <Route path="/user-guide-page" element={<UserGuidePage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/calendar-callback" element={<CalendarCallback />} />

          {/* ==== AUTHENTICATED APP ROUTES (Non-Social) ==== */}
          <Route path="/dashboard" element={<Index />} />
          <Route path="/notes/:noteId?" element={<Index />} />
          <Route path="/note/:noteId?" element={<Index />} />
          <Route path="/recordings" element={<Index />} />
          <Route path="/schedule" element={<Index />} />
          <Route path="/chat" element={<Index />} />

          {/* Protected chat session route */}
          <Route path="/chat/:sessionId" element={<Index />} />

          <Route path="/documents" element={<Index />} />
          <Route path="/settings" element={<Index />} />
          <Route path="/quizzes" element={<Index />} />
          <Route path="/quizzes/:tab" element={<Index />} />
          <Route path="/quizzes/:tab/:sessionId" element={<Index />} />
          <Route path="/library" element={<Index />} />
          <Route path="/library/:tab" element={<Index />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/pricing" element={<SubscriptionPage />} />
          
          {/* ==== PODCAST ROUTES - Protected ==== */}
          <Route path="/podcasts" element={<Index />} />
          <Route path="/podcasts/:podcastId" element={<Index />} />
          <Route path="/podcast/:id" element={<Index />} />
          {/* Dedicated live podcast route (renders inside app shell) */}
          <Route path="/podcast/live/:id" element={<Index />} />
          
          {/* ==== SOCIAL ROUTES - Protected ==== */}
          <Route path="/social" element={<Index />} />
          <Route path="/social/:tab" element={<Index />} />

          {/* Protected social routes */}
          <Route path="/social/post/:postId" element={<Index />} />
          <Route path="/social/group/:groupId" element={<Index />} />
          <Route path="/social/profile/:userId" element={<Index />} />

          {/* ==== ADMIN ROUTES - Protected by AdminLayout ==== */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/courses" element={<CourseManagement />} />
            <Route path="/admin/admins" element={<AdminManagement />} />
            <Route path="/admin/moderation" element={<ContentModeration />} />
            <Route path="/admin/settings" element={<SystemSettings />} />
            <Route path="/admin/logs" element={<ActivityLogs />} />
          </Route>

          {/* ==== 404 NOT FOUND ==== */}
          <Route path="*" element={<NotFound />} />
        </Routes> 
      </Suspense>
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <Analytics />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AdminAuthProvider>
              <AppProvider>
                <AppWithSEO />
              </AppProvider>
            </AdminAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;