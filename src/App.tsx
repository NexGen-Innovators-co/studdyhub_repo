import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from "./contexts/AppContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Analytics />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider> {/* AuthProvider wraps AppProvider */}
          <AppProvider>
            <Routes>
              {/* Public Landing Page Route */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Routes */}
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

              {/* Authenticated Application Routes */}
              <Route path="/dashboard" element={<Index />} />
              <Route path="/notes" element={<Index />} />
              <Route path="/note" element={<Index />} />
              <Route path="/recordings" element={<Index />} />
              <Route path="/schedule" element={<Index />} />
              <Route path="/chat" element={<Index />} />
              <Route path="/chat/:sessionId" element={<Index />} />
              <Route path="/documents" element={<Index />} />
              <Route path="/social" element={<Index />} />
              <Route path="/settings" element={<Index />} />

              {/* Catch-all for NotFound */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;