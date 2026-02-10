// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/LayoutComponents';
import { Home, Search, HelpCircle } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <AppLayout>
      <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800">
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }} />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative text-center px-4 py-16">
          <div className="w-24 h-24 mx-auto bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 border border-white/20">
            <Search className="h-10 w-10 text-white/80" />
          </div>

          <h1 className="text-8xl md:text-9xl font-extrabold text-white mb-2 tracking-tight drop-shadow-lg">404</h1>
          <h2 className="text-2xl md:text-3xl font-bold text-blue-100 mb-4">Page Not Found</h2>
          <p className="text-blue-200/80 mb-10 text-lg max-w-md mx-auto leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all">
                <Home className="h-5 w-5" />
                Back to Home
              </button>
            </Link>
            <Link to="/contact">
              <button className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition-all">
                <HelpCircle className="h-5 w-5" />
                Get Help
              </button>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;