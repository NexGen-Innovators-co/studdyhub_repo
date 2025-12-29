// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/LayoutComponents';
import { Home, Search, AlertTriangle } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <AppLayout>
      <div className="relative w-full h-64 md:h-96 overflow-hidden mb-8">
        <img
          src="/public/screenshots/404-hero.jpg"
          alt="404 Not Found Hero"
          className="object-cover w-full h-full brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/70 to-transparent flex flex-col justify-end items-center p-8">
          <img src="/public/screenshots/404-icon.jpg" alt="404 Icon" className="w-24 h-24 rounded-full object-cover border-4 border-blue-200 mb-4 shadow-lg" />
          <h1 className="text-6xl font-bold text-white mb-2 drop-shadow-lg">404</h1>
          <h2 className="text-2xl font-bold text-blue-100 mb-4 drop-shadow">Page Not Found</h2>
          <p className="text-blue-200 mb-8 text-lg max-w-xl text-center">The page you're looking for doesn't exist or has been moved. Let's get you back on track.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                Back to Home
              </button>
            </Link>
            <Link to="/contact">
              <button className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                Get Help
              </button>
            </Link>
          </div>
          <div className="mt-8 p-4 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              If you believe this is an error, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;