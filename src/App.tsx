import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SitemapPage from "./pages/SitemapPage"; // Import SitemapPage

const queryClient = new QueryClient();

// A simple component for public routes that don't need AuthProvider
const PublicLayout = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// A component for private routes that need AuthProvider
const PrivateLayout = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes - These routes are outside of AuthProvider */}
          <Route path="/sitemap.xml" element={<PublicLayout><SitemapPage /></PublicLayout>} />
          <Route path="/auth" element={<PublicLayout><Auth /></PublicLayout>} />
          
          {/* Private Routes - All routes under here will be protected by AuthProvider */}
          {/* The "/*" path ensures that any other path falls into this authenticated section */}
          <Route path="/*" element={<PrivateLayout><Index /></PrivateLayout>} />
          
          {/* Fallback for any unmatched paths that are not explicitly public or private */}
          <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
