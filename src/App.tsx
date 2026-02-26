// App.tsx - Updated with simpler SEO approach
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { AdminAuthProvider } from "./hooks/useAdminAuth";
import React, { Suspense, lazy } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from "./contexts/AppContext";
import { AdminLayout } from "./components/admin/AdminLayout";
import { HelmetProvider } from "react-helmet-async";
import DynamicHead from "./components/seo/DynamicHead";
import { OfflineIndicator } from "./components/layout/OfflineIndicator";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import { OnboardingGuard } from "./components/onboarding/OnboardingGuard";

// LinkedIn-style branded loader for protected / heavy routes
export const BrandedLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950">
    <img
      src="/siteimage.png"
      alt="StuddyHub AI"
      className="h-16 w-16 object-contain mb-4 animate-pulse"
    />
    <span className="text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight mb-6">
      StuddyHub <span className="text-blue-600 dark:text-blue-400">AI</span>
    </span>
    {/* Thin animated progress bar */}
    <div className="w-48 h-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400 animate-[shimmer_1.4s_ease-in-out_infinite]" />
    </div>
    <style>{`
      @keyframes shimmer {
        0%   { width: 0%; margin-left: 0; }
        50%  { width: 70%; margin-left: 15%; }
        100% { width: 0%; margin-left: 100%; }
      }
    `}</style>
  </div>
);

// Lightweight empty placeholder for public static pages (no visible loader)
const EmptyFallback = () => <div className="min-h-screen" />;

// ─── Lazy-loaded pages (code-split per route) ───
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Contact = lazy(() => import("./pages/ContactUs"));
const Blog = lazy(() => import("./pages/Blogs"));
const Integrations = lazy(() => import("./pages/Integrations"));
const TermsOfService = lazy(() => import("./pages/TermsOfServices"));
const Careers = lazy(() => import("./pages/Careers"));
const APIPage = lazy(() => import("./pages/APIs"));
const DocumentationPage = lazy(() => import("./pages/DocumentationPage"));
const UserGuidePage = lazy(() => import("./pages/UserGuide"));
const SubscriptionPage = lazy(() => import("./components/subscription").then(m => ({ default: m.SubscriptionPage })));
const CalendarCallback = lazy(() => import("./pages/CalendarCallback"));

// Lazy load admin components
const AdminDashboard = lazy(() => import("./components/admin/adminDashboard"));
const UserManagement = lazy(() => import("./components/admin/UserManagement"));
const AdminManagement = lazy(() => import("./components/admin/AdminManagement"));
const ContentModeration = lazy(() => import("./components/admin/ContentModeration"));
const SystemSettings = lazy(() => import("./components/admin/SystemSettings"));
const ActivityLogs = lazy(() => import("./components/admin/ActivityLogs"));
const SystemErrorLogs = lazy(() => import("./components/admin/SystemErrorLogs"));
const AIAdminInsights = lazy(() => import("./components/admin/AIAdminInsights"));
const PlatformUpdates = lazy(() => import("./components/admin/PlatformUpdates"));
const CourseManagement = lazy(() => import("./components/admin/CourseManagement"));
const RoleVerificationAdmin = lazy(() => import("./components/admin/RoleVerificationAdmin"));
const AdminInstitutions = lazy(() => import("./components/admin/AdminInstitutions"));
const CourseDashboard = lazy(() => import("./pages/CourseDashboard"));

// Lazy load educator components
const EducatorLayout = lazy(() => import("./components/educator/EducatorLayout"));
const EducatorDashboard = lazy(() => import("./components/educator/EducatorDashboard"));
const EducatorCourses = lazy(() => import("./components/educator/courses/EducatorCourses"));
const InstitutionAdminDashboard = lazy(() => import("./components/educator/institution/InstitutionAdminDashboard"));
const CourseStudents = lazy(() => import("./components/educator/courses/CourseStudents"));
const CourseAnalyticsView = lazy(() => import("./components/educator/courses/CourseAnalyticsView"));
const InstitutionStudentsPage = lazy(() => import("./components/educator/InstitutionStudentsPage"));
const InstitutionAnalyticsPage = lazy(() => import("./components/educator/InstitutionAnalyticsPage"));
const InstitutionSettings = lazy(() => import("./components/educator/institution/InstitutionSettingsPage"));
const JoinInstitution = lazy(() => import("./pages/JoinInstitution"));
const TestimonialModeration = lazy(() => import("./components/admin/TestimonialModeration"));
const RoleUpgradePanel = lazy(() => import("./components/educator/RoleUpgradePanel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 minutes — prevent excessive refetches
      gcTime: 10 * 60 * 1000,           // 10 minutes garbage-collection
      refetchOnWindowFocus: false,       // don't refetch every tab switch
      retry: 2,                          // retry twice on failure
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: 1,
    },
  },
});

const Fallback = () => <BrandedLoader />;

// Create a wrapper component for SEO
const AppWithSEO = () => {
  const location = useLocation();

  // Determine transition key to group dashboard routes
  const getPageKey = (pathname: string) => {
    // List of prefixes that render the main App Shell (Index.tsx)
    const appShellRoutes = [
      '/dashboard', '/notes', '/note', '/recordings', '/schedule',
      '/chat', '/documents', '/settings', '/quizzes', '/library',
      '/podcasts', '/social', '/educator'
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
      <ErrorBoundary>
        <Suspense fallback={<BrandedLoader />}>
          <Routes location={location}>
            {/* ==== PUBLIC ROUTES (lightweight Suspense — no premium loader) ==== */}
            {/* PUBLIC ROUTES — lightweight empty fallback (no visible loader) */}
            <Route path="/" element={<Suspense fallback={<EmptyFallback />}><LandingPage /></Suspense>} />
            <Route path="/privacy-policy" element={<Suspense fallback={<EmptyFallback />}><PrivacyPolicy /></Suspense>} />
            <Route path="/about-us" element={<Suspense fallback={<EmptyFallback />}><AboutUs /></Suspense>} />
            <Route path="/contact" element={<Suspense fallback={<EmptyFallback />}><Contact /></Suspense>} />
            <Route path="/blogs" element={<Suspense fallback={<EmptyFallback />}><Blog /></Suspense>} />
            <Route path="/integrations" element={<Suspense fallback={<EmptyFallback />}><Integrations /></Suspense>} />
            <Route path="/terms-of-service" element={<Suspense fallback={<EmptyFallback />}><TermsOfService /></Suspense>} />
            <Route path="/careers" element={<Suspense fallback={<EmptyFallback />}><Careers /></Suspense>} />
            <Route path="/api" element={<Suspense fallback={<EmptyFallback />}><APIPage /></Suspense>} />
            <Route path="/documentation-page" element={<Suspense fallback={<EmptyFallback />}><DocumentationPage /></Suspense>} />
            <Route path="/user-guide-page" element={<Suspense fallback={<EmptyFallback />}><UserGuidePage /></Suspense>} />
            <Route path="/auth" element={<Suspense fallback={<EmptyFallback />}><Auth /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<EmptyFallback />}><ResetPassword /></Suspense>} />
            <Route path="/calendar-callback" element={<Suspense fallback={<EmptyFallback />}><CalendarCallback /></Suspense>} />
            <Route path="/join/:inviteToken" element={<Suspense fallback={<EmptyFallback />}><JoinInstitution /></Suspense>} />

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
            <Route path="/course/:courseId" element={<Suspense fallback={<Fallback />}><CourseDashboard /></Suspense>} />
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

            {/* ==== EDUCATOR UPGRADE - Outside guard so non-educators can access ==== */}
            <Route path="/educator/upgrade" element={<Suspense fallback={<Fallback />}><RoleUpgradePanel /></Suspense>} />

            {/* ==== EDUCATOR ROUTES - Protected by EducatorGuard ==== */}
            <Route element={<Suspense fallback={<Fallback />}><EducatorLayout /></Suspense>}>
              <Route path="/educator" element={<EducatorDashboard />} />
              <Route path="/educator/courses" element={<EducatorCourses />} />
              <Route path="/educator/institution" element={<InstitutionAdminDashboard />} />
              <Route path="/educator/members" element={<InstitutionStudentsPage />} />
              <Route path="/educator/analytics" element={<InstitutionAnalyticsPage />} />
              <Route path="/educator/settings" element={<InstitutionSettings />} />
            </Route>

            {/* ==== ADMIN ROUTES - Protected by AdminLayout ==== */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/courses" element={<CourseManagement />} />
              <Route path="/admin/admins" element={<AdminManagement />} />
              <Route path="/admin/moderation" element={<ContentModeration />} />
              <Route path="/admin/testimonials" element={<Suspense fallback={<Fallback />}><TestimonialModeration /></Suspense>} />
              <Route path="/admin/settings" element={<SystemSettings />} />
              <Route path="/admin/logs" element={<ActivityLogs />} />
              <Route path="/admin/errors" element={<Suspense fallback={<Fallback />}><SystemErrorLogs /></Suspense>} />
              <Route path="/admin/ai-insights" element={<Suspense fallback={<Fallback />}><AIAdminInsights /></Suspense>} />
              <Route path="/admin/updates" element={<Suspense fallback={<Fallback />}><PlatformUpdates /></Suspense>} />
              <Route path="/admin/verification" element={<Suspense fallback={<Fallback />}><RoleVerificationAdmin /></Suspense>} />
              <Route path="/admin/institutions" element={<Suspense fallback={<Fallback />}><AdminInstitutions /></Suspense>} />
            </Route>

            {/* ==== 404 NOT FOUND ==== */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <Analytics />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <BrowserRouter future={{ v7_relativeSplatPath: true }}>
            <AuthProvider>
              <AdminAuthProvider>
                <AppProvider>
                  <OnboardingGuard>
                    <AppWithSEO />
                  </OnboardingGuard>
                </AppProvider>
              </AdminAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;