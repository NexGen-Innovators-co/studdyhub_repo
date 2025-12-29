import React, { useState } from 'react';
import { moderateContent, ContentModerationResult } from '@/services/contentModerationService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  BookOpen, 
  Lightbulb, 
  XCircle,
  Sparkles,
  Info
} from 'lucide-react';

interface ContentModerationFeedbackProps {
  result: ContentModerationResult;
  onRevise?: () => void;
  onAppeal?: () => void;
}

export const ContentModerationFeedback: React.FC<ContentModerationFeedbackProps> = ({
  result,
  onRevise,
  onAppeal
}) => {
  if (result.approved) {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-200">
          Educational Content Approved!
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          <div className="space-y-2">
            <p>{result.reason}</p>
            {result.category && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Category:</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  {result.category}
                </Badge>
              </div>
            )}
            {result.topics && result.topics.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Topics:</span>
                {result.topics.map((topic, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">
                Educational Value: {Math.round(result.educationalValue.score * 100)}%
              </span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="p-6 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
              Let's Make This More Educational! 📚
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              {result.reason || 'Your content needs to be more focused on learning and education.'}
            </p>
          </div>
        </div>

        {/* Educational Value Score */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Educational Value Score</span>
            <span className="text-xl font-bold text-orange-600">
              {Math.round(result.educationalValue.score * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all"
              style={{ width: `${result.educationalValue.score * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {result.educationalValue.reasoning}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            <strong>Minimum required:</strong> 60% • Keep it educational, helpful, and focused on learning!
          </p>
        </div>

        {/* Guidelines */}
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-2">
            <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                Educational Content Guidelines
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Share knowledge, explain concepts, or ask genuine questions</li>
                <li>Focus on academic subjects, skills, or learning resources</li>
                <li>Provide value to other students and learners</li>
                <li>Avoid promotional content, spam, or off-topic discussions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {result.suggestions && result.suggestions.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  How to Improve Your Post
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {result.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {onRevise && (
            <Button 
              onClick={onRevise}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              variant="default"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              ✏️ Revise Content
            </Button>
          )}
          {onAppeal && (
            <Button 
              onClick={onAppeal}
              variant="outline"
              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Request Review
            </Button>
          )}
        </div>

        {/* Info Note */}
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            This automated check helps maintain StuddyHub as a quality educational platform. 
            If you believe this is an error, you can request a manual review.
          </p>
        </div>
      </div>
    </Card>
  );
};

interface ContentGuidelinesProps {
  onClose?: () => void;
}

export const ContentGuidelines: React.FC<ContentGuidelinesProps> = ({ onClose }) => {
  const categories = [
    'Science', 'Mathematics', 'Technology', 'Engineering',
    'History', 'Literature', 'Language Learning', 'Arts',
    'Business', 'Economics', 'Health', 'Medicine',
    'Philosophy', 'Psychology', 'Social Sciences',
    'Study Tips', 'Exam Preparation', 'Career Guidance'
  ];

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h3 className="text-xl font-bold">Educational Content Guidelines</h3>
        </div>

        <p className="text-gray-600 dark:text-gray-400">
          StuddyHub is a learning platform focused on educational content. Here's what we encourage:
        </p>

        <div className="space-y-4">
          {/* What's Encouraged */}
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              What's Encouraged
            </h4>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
              <li>Share notes, study guides, and learning resources</li>
              <li>Ask questions about academic subjects</li>
              <li>Explain concepts or help others understand topics</li>
              <li>Discuss study techniques and productivity tips</li>
              <li>Share educational videos, articles, or tools</li>
              <li>Organize study groups or tutoring sessions</li>
            </ul>
          </div>

          {/* What's Not Allowed */}
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 border border-red-200">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              What's Not Allowed
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
              <li>Promotional content or advertisements</li>
              <li>Spam or irrelevant posts</li>
              <li>Off-topic discussions unrelated to learning</li>
              <li>Inappropriate or offensive content</li>
              <li>Plagiarized content without attribution</li>
            </ul>
          </div>

          {/* Allowed Categories */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
              Educational Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {categories.map((category, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {onClose && (
          <Button onClick={onClose} className="w-full">
            Got It
          </Button>
        )}
      </div>
    </Card>
  );
};
