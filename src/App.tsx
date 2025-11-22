import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import { SocialDataProvider } from "./components/social/context/SocialDataContext";
import { SocialFeed } from "./components/social/SocialFeed"; // Import SocialFeed

// Lazy load admin components
const AdminDashboard = lazy(() => import("./components/admin/adminDashboard"));
const UserManagement = lazy(() => import("./components/admin/UserManagement"));
const AdminManagement = lazy(() => import("./components/admin/AdminManagement"));
const ContentModeration = lazy(() => import("./components/admin/ContentModeration"));
const SystemSettings = lazy(() => import("./components/admin/SystemSettings"));
const ActivityLogs = lazy(() => import("./components/admin/ActivityLogs"));

const queryClient = new QueryClient();

const Fallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-950">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Wrapper component for Social routes that provides the SocialDataProvider
// This gets userProfile from AppContext
const SocialRoutesWrapper = ({ children }: { children: React.ReactNode }) => {
  // We'll pass userProfile through context or props
  return (
    <SocialDataProvider>
      {children}
    </SocialDataProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Analytics />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AdminAuthProvider>
            <AppProvider>
              <Suspense fallback={<Fallback />}>
                <Routes>
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

                  {/* ==== AUTHENTICATED APP ROUTES (Non-Social) ==== */}
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/notes" element={<Index />} />
                  <Route path="/note" element={<Index />} />
                  <Route path="/recordings" element={<Index />} />
                  <Route path="/schedule" element={<Index />} />
                  <Route path="/chat" element={<Index />} />
                  <Route path="/chat/:sessionId" element={<Index />} />
                  <Route path="/documents" element={<Index />} />
                  <Route path="/settings" element={<Index />} />

                  {/* ==== SOCIAL ROUTES - Wrapped with SocialDataProvider ==== */}
                  <Route path="/social" element={<SocialRoutesWrapper><Index /></SocialRoutesWrapper>} />
                  <Route path="/social/:tab" element={<SocialRoutesWrapper><Index /></SocialRoutesWrapper>} />
                  <Route path="/social/post/:postId" element={<SocialRoutesWrapper><Index /></SocialRoutesWrapper>} />
                  <Route path="/social/group/:groupId" element={<SocialRoutesWrapper><Index /></SocialRoutesWrapper>} />
                  {/* ADD THIS LINE: Social profile route */}
                  <Route path="/social/profile/:userId" element={<SocialRoutesWrapper><Index /></SocialRoutesWrapper>} />

                  {/* ==== ADMIN ROUTES - Protected by AdminLayout ==== */}
                  <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                    <Route path="/admin/admins" element={<AdminManagement />} />
                    <Route path="/admin/moderation" element={<ContentModeration />} />
                    <Route path="/admin/settings" element={<SystemSettings />} />
                    <Route path="/admin/logs" element={<ActivityLogs />} />
                  </Route>

                  {/* ==== 404 NOT FOUND ==== */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppProvider>
          </AdminAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;