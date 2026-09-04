// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../modules/layout/components/LayoutComponents';
import { Home } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <AppLayout>
      <div className="min-h-[70vh] flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center px-4 py-16">
          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Page not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Home className="h-5 w-5" />
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
