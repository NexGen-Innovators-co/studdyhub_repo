// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/LayoutComponents';
import { Home, Search, AlertTriangle } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <AppLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
            <AlertTriangle className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Page Not Found
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <Home className="h-5 w-5" />
                Back to Home
              </button>
            </Link>

            <Link to="/contact">
              <button className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <Search className="h-5 w-5" />
                Get Help
              </button>
            </Link>
          </div>

          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If you believe this is an error, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;