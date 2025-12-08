// components/ProcessingQueuePanel.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';

interface ProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  estimatedTimeRemaining: number | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  title: string;
  type: 'transcription' | 'summarization' | 'quiz_generation';
}

interface ProcessingQueuePanelProps {
  jobs: ProcessingJob[];
  onCancelJob?: (jobId: string) => void;
  onClearCompleted?: () => void;
  onRefresh?: () => void;
}

export const ProcessingQueuePanel: React.FC<ProcessingQueuePanelProps> = ({
  jobs,
  onCancelJob,
  onClearCompleted,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'error');

  const formatTime = (seconds: number | null) => {
    if (seconds === null || !isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
    }
  };

  const getTypeLabel = (type: ProcessingJob['type']) => {
    switch (type) {
      case 'transcription':
        return 'Transcription';
      case 'summarization':
        return 'Summary';
      case 'quiz_generation':
        return 'Quiz Generation';
    }
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Loader2 className={`h-5 w-5 ${activeJobs.length > 0 ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
            Processing Queue
            {activeJobs.length > 0 && (
              <span className="text-sm font-normal text-blue-500">
                ({activeJobs.length} active)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Active Jobs */}
          {activeJobs.map(job => (
            <div 
              key={job.id}
              className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(job.status)}
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {job.title}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">
                  {getTypeLabel(job.type)}
                </span>
              </div>
              
              <Progress value={job.progress} className="h-2 mb-2" />
              
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{getStatusLabel(job.status)} - {job.progress}%</span>
                {job.estimatedTimeRemaining !== null && (
                  <span>ETA: {formatTime(job.estimatedTimeRemaining)}</span>
                )}
              </div>
              
              {onCancelJob && job.status === 'pending' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => onCancelJob(job.id)}
                >
                  Cancel
                </Button>
              )}
            </div>
          ))}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div className="border-t dark:border-gray-700 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recent ({completedJobs.length})
                </span>
                {onClearCompleted && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-500 hover:text-gray-700"
                    onClick={onClearCompleted}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {completedJobs.slice(0, 5).map(job => (
                  <div 
                    key={job.id}
                    className={`p-2 rounded-lg flex items-center justify-between ${
                      job.status === 'completed' 
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                        {job.title}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {job.completedAt 
                        ? new Date(job.completedAt).toLocaleTimeString() 
                        : '--'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
