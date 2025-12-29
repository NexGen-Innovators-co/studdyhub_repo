import React, { useState, useEffect } from 'react';
import { Lightbulb, X, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../ui/button';

interface QuickTipsProps {
  userPreferences?: {
    showTips: boolean;
    tipCategories: string[];
  };
}

export const QuickTips: React.FC<QuickTipsProps> = ({ userPreferences }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const location = useLocation();
  
  // Get user preference from localStorage or props
  const shouldShowTips = userPreferences?.showTips ?? 
    localStorage.getItem('showQuickTips') !== 'false';

  useEffect(() => {
    if (!shouldShowTips) {
      setIsVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 30000);

    return () => clearTimeout(timer);
  }, [shouldShowTips]);

  useEffect(() => {
    if (shouldShowTips) {
      setIsVisible(true);
    }
  }, [location.pathname, shouldShowTips]);

  const hidePermanently = () => {
    setIsVisible(false);
    localStorage.setItem('showQuickTips', 'false');
  };

  const hideTemporarily = () => {
    setIsVisible(false);
  };

  if (!isVisible || !shouldShowTips) return null;

  const routeTips = {
    '/dashboard': [
      "💡 Check your daily insights and recent activity here",
      "💡 Quick access to create new notes, recordings, or schedule items",
      "💡 View your learning progress and statistics",
      "💡 Navigate to different sections using the sidebar or quick links",
    ],
    '/notes': [
      "💡 Select text and click the sparkle icon for AI assistance",
      "💡 Upload PDFs or audio files to generate notes automatically",
      "💡 Use flashcards to turn your notes into study material",
      "💡 Use the save button to save note once you are done",
    ],
    '/recordings': [
      "💡 Upload class recordings to generate automatic transcripts",
      "💡 Create quizzes from your recordings to test your knowledge",
      "💡 Use AI to summarize long recordings into key points",
      "💡 Bookmark important timestamps for quick review",
      "💡 Record new classes directly using the voice recorder",
      "💡 Download recordings for offline access",
      "💡 Reprocess audio to improve transcription quality",
      "💡 Generate AI-powered notes from your recordings",
      "💡 View quiz history to track your learning progress",
    ],
    '/schedule': [
      "💡 Color-code your schedule items for better organization",
      "💡 Set reminders for important deadlines and classes",
      "💡 Drag and drop to reschedule items easily",
      "💡 Break large tasks into smaller scheduled items",
    ],
    '/chat': [
      "💡 Upload documents to chat with their content",
      "💡 Select text from notes to ask specific questions",
      "💡 Use different AI models for various types of questions",
      "💡 Save important conversations for future reference",
    ],
    '/documents': [
      "💡 Upload PDFs, Word docs, or text files for processing",
      "💡 Documents are automatically analyzed and made searchable",
      "💡 Generate notes, summaries, or quizzes from your documents",
      "💡 Organize documents with tags and categories",
    ],
    '/settings': [
      "💡 Customize your learning preferences for better AI assistance",
      "💡 Connect external services and integrations",
      "💡 Manage your subscription and billing preferences",
      "💡 Export your data or manage account privacy settings",
    ],
    '/social': [
      "💡 Share your notes and study materials with the community",
      "💡 Discover learning resources from other students",
      "💡 Join study groups for collaborative learning",
      "💡 Follow topics and users that match your interests",
    ],
    '/admin': [
      "💡 Monitor system performance and usage statistics",
      "💡 Manage platform settings and configurations",
      "💡 View activity logs for security monitoring",
      "💡 Access admin tools in the navigation sidebar",
    ],
  };

  // Find matching tips for current route
  const getCurrentTips = () => {
    const path = location.pathname;
    
    // Exact match first
    if (routeTips[path as keyof typeof routeTips]) {
      return routeTips[path as keyof typeof routeTips];
    }
    
    // Partial match for nested routes
    for (const [route, tips] of Object.entries(routeTips)) {
      if (path.startsWith(route)) {
        return tips;
      }
    }
    
    // Default tips
    return [
      "💡 Use the sidebar to navigate between different features",
      "💡 Check the tutorial for detailed feature guides",
      "💡 Your progress is automatically saved as you work",
      "💡 Use keyboard shortcuts for faster navigation",
    ];
  };

  const tips = getCurrentTips();

  return (
    <>
      <div className="fixed bottom-4 right-4 bg-blue-50 dark:bg-blue-800/95 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg p-4 max-w-sm z-50 animate-in fade-in duration-500">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
              Quick Tips - {getRouteName(location.pathname)}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
            >
              <Settings className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={hideTemporarily}
              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {tips.map((tip, index) => (
            <p key={index} className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              {tip}
            </p>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700 flex justify-between">
          <button
            onClick={hideTemporarily}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Got it
          </button>
          <button
            onClick={hidePermanently}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Don't show again
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="font-semibold mb-4">Quick Tips Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={shouldShowTips}
                  onChange={(e) => {
                    localStorage.setItem('showQuickTips', e.target.checked.toString());
                    window.location.reload();
                  }}
                />
                Show quick tips
              </label>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper function to get route name for display
const getRouteName = (path: string): string => {
  const routeMap: { [key: string]: string } = {
    '/dashboard': 'Dashboard',
    '/notes': 'Notes',
    '/recordings': 'Recordings',
    '/schedule': 'Schedule',
    '/chat': 'AI Chat',
    '/documents': 'Documents',
    '/settings': 'Settings',
    '/social': 'Social Feed',
    '/admin': 'Admin',
  };

  for (const [route, name] of Object.entries(routeMap)) {
    if (path.startsWith(route)) {
      return name;
    }
  }

  return 'App';
};