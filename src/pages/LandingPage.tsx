// src/pages/LandingPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 text-slate-800 p-6 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100">
      <div className="text-center max-w-2xl mx-auto">
        <Sparkles className="h-20 w-20 text-blue-600 mx-auto mb-6 animate-pulse-slow dark:text-purple-400" />
        <h1 className="text-5xl font-extrabold mb-4 leading-tight">
          Welcome to NoteMind AI
        </h1>
        <p className="text-xl text-slate-600 mb-8 dark:text-gray-300">
          Your intelligent companion for seamless learning and organization.
          Transform your notes, recordings, and schedules with the power of AI.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/auth">
            <Button
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-all duration-300 transform hover:scale-105 dark:bg-purple-600 dark:hover:bg-purple-700"
            >
              Get Started
            </Button>
          </Link>
          <Link to="/auth"> {/* You might want a different route for a "Learn More" or "Demo" */}
            <Button
              size="lg"
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700 shadow-md transition-all duration-300 transform hover:scale-105 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-gray-700 dark:hover:text-purple-300"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
