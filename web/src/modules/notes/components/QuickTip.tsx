import React, { useState, useEffect } from 'react';
import { X, Settings, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../ui/components/button';

interface QuickTipsProps {
  userPreferences?: {
    showTips: boolean;
    tipCategories: string[];
  };
}

export const QuickTips: React.FC<QuickTipsProps> = ({ userPreferences }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShowTips, setShouldShowTips] = useState(() => 
    userPreferences?.showTips ?? localStorage.getItem('showQuickTips') !== 'false'
  );
  const location = useLocation();

  // Show/hide tips on route change if enabled
  useEffect(() => {
    if (shouldShowTips) {
      setIsVisible(true);
    }
  }, [location.pathname, shouldShowTips]);

  const hidePermanently = () => {
    setIsVisible(false);
    localStorage.setItem('showQuickTips', 'false');
    setShouldShowTips(false);
  };

  const toggleTips = () => {
    setIsVisible(!isVisible);
  };

  // Expose toggleTips globally for other components
  useEffect(() => {
    (window as any).__toggleTips = toggleTips;
    return () => {
      delete (window as any).__toggleTips;
    };
  }, []);

  // Return null only if tips should never show and nothing is visible
  if (!shouldShowTips && !isVisible) return null;

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
    '/quizzes': [
      "💡 Generate quizzes from recordings, notes, or use AI for custom topics",
      "💡 Switch between tabs to access different quiz creation methods",
      "💡 View your quiz history to track performance and review past attempts",
      "💡 Higher difficulty levels yield more XP rewards",
      "💡 Check daily limits in the right sidebar",
      "💡 Join live quizzes to compete with others in real-time",
    ],
    '/quizzes/live': [
      "💡 Host a quiz by selecting from your created quizzes",
      "💡 Join a quiz using the 6-character join code",
      "💡 Auto mode advances questions automatically for everyone",
      "💡 Individual mode lets each player progress at their own pace",
      "💡 Share the join code with friends to invite them",
      "💡 View completed sessions in the History tab",
      "💡 Your score and ranking are displayed at the end",
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
    '/podcasts': [
      "💡 Generate AI podcasts from your notes, recordings, or custom topics",
      "💡 Create live audio or video sessions to stream in real-time",
      "💡 Invite members to collaborate on private podcasts",
      "💡 Share podcasts publicly to reach a wider audience",
      "💡 Download podcasts for offline listening and review",
      "💡 Generate AI cover images to make your podcasts stand out",
      "💡 View transcripts and jump to specific segments instantly",
      "💡 Track listener count and engagement on your podcasts",
      "💡 Use filters to find trending, recent, or most popular content",
      "💡 Join live streams and interact with hosts in real-time",
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
      {/* Tips Panel - shows when isVisible is true (always can be shown via floating button) */}
      {isVisible && (
        <div className="fixed bottom-28 right-2 lg:bottom-20 lg:right-2 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-900/95 dark:via-slate-900/95 dark:to-purple-900/95 border-2 border-blue-300 dark:border-blue-700 rounded-2xl shadow-2xl p-5 max-w-md z-50 animate-in fade-in slide-in-from-bottom duration-500 backdrop-blur-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 text-base">
                Quick Tips
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {getRouteName(location.pathname)}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTips}
              className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2.5 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {tips.map((tip, index) => (
            <div 
              key={index} 
              className="flex gap-3 p-2.5 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
            >
              <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {tip.replace('💡 ', '')}
              </p>
            </div>
          ))}
        </div>
        
        <div className="pt-3 border-t-2 border-blue-200 dark:border-blue-800 flex justify-between items-center">
          <Button
            onClick={toggleTips}
            size="sm"
            variant="ghost"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-4 py-2 rounded-lg transition-all"
          >
            Got it!
          </Button>
          <Button
            onClick={hidePermanently}
            size="sm"
            variant="ghost"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-2 rounded-lg transition-all"
          >
            Don't show again
          </Button>
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
    '/quizzes': 'Quizzes',
    '/settings': 'Settings',
    '/social': 'Social Feed',
    '/admin': 'Admin',
  };

  // Check for specific nested routes first
  if (path.includes('/quizzes') && path.includes('live')) {
    return 'Live Quiz';
  }

  for (const [route, name] of Object.entries(routeMap)) {
    if (path.startsWith(route)) {
      return name;
    }
  }

  return 'App';
};