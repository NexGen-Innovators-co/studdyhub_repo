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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes - accessible without authentication */}
          <Route path="/sitemap.xml" element={<SitemapPage />} />

          {/* Authenticated Routes - wrapped within AuthProvider */}
          <Route path="/auth" element={<Auth />} />
          {/* This is the key change: Index will now handle all paths starting with / */}
          <Route path="/*" element={<AuthProvider><Index /></AuthProvider>} /> {/* Wrap Index with AuthProvider */}
          
          {/* The catch-all for NotFound should come after all other specific routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
