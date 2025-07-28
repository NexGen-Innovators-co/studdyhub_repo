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
