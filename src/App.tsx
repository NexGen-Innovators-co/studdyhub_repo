import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage"; // NEW: Import LandingPage
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page Route */}
          <Route path="/" element={<LandingPage />} /> {/* NEW: Landing page is now the root */}

          {/* Public Auth Route */}

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

          {/* Authenticated Application Routes - wrapped within AuthProvider */}
          {/* This route now handles all paths that are not '/' or '/auth' */}
          <Route path="/*" element={<AuthProvider><Index /></AuthProvider>} />

          {/* The catch-all for NotFound should come after all other specific routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
