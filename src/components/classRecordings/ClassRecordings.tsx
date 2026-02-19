// Redesigned ClassRecordings with modern design matching Social & Dashboard patterns
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Clock, BookOpen, FileText, Mic, Download, Trash2, Play, Pause,
  Upload, Plus, Headphones, Calendar, MoreHorizontal, Search,
  RefreshCw, Loader2, ChevronRight, Volume2, Sparkles, Clipboard,
  CheckCircle2,
  Lightbulb
} from 'lucide-react';
import { ClassRecording } from '../../types/Class';
import { formatDate } from './utils/helpers';
import { EnhancedVoiceRecorder } from './components/EnhancedVoiceRecorder';
import { AudioUploadSection } from './components/AudioUploadSection';
import { useAudioProcessing } from './hooks/useAudioProcessing';
import { RecordingSidePanel } from './components/RecordingSidePanel';
import { toast } from 'sonner';
import { useConfirmDialog } from '../ui/confirm-dialog';
import { useRealtimeSync } from './hooks/useRealTimeSync';
import { supabase } from '../../integrations/supabase/client';
import { UserStats } from '../../types/EnhancedClasses';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '../../services/globalSearchService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { useAppContext } from '../../hooks/useAppContext';

interface ClassRecordingsProps {
  recordings?: ClassRecording[];
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>;
  onReprocessAudio: (fileUrl: string, documentId: string, targetLang?: string) => Promise<void>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [],
  onAddRecording,
  onUpdateRecording,
  onGenerateNote,
  onDeleteRecording,
  onReprocessAudio,
  searchQuery: externalSearchQuery,
  onSearchChange,
}) => {
  const { refreshData, dataLoading } = useAppContext();
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'record' | 'upload'>('all');
  const [internalSearch, setInternalSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<'transcript' | 'summary'>('transcript');
  const [audioProgress, setAudioProgress] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCurrentlyRecording, setIsCurrentlyRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);

  const effectiveSearch = externalSearchQuery ?? internalSearch;

  // Handle recording state changes from EnhancedVoiceRecorder
  const handleRecordingStateChange = useCallback((state: { isRecording: boolean; isPaused: boolean }) => {
    setIsCurrentlyRecording(state.isRecording);
    setIsRecordingPaused(state.isPaused);
  }, []);

  // Safe tab switch – warn user if recording is in progress
  const handleTabChange = useCallback((newTab: string) => {
    if (isCurrentlyRecording && activeTab === 'record' && newTab !== 'record') {
      // Allow switching but don't stop recording
      toast.info('Recording continues in background. Switch back to the Record tab to manage it.', { duration: 3000 });
    }
    setActiveTab(newTab as typeof activeTab);
  }, [isCurrentlyRecording, activeTab]);

  // Initialize global search hook
  const { search, results: searchResults, isSearching: isSearchingRecordings } = useGlobalSearch(
    SEARCH_CONFIGS.recordings,
    userId,
    { debounceMs: 500 }
  );

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
    onSearchChange?.(value);
  };

  // Fetch user ID
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  // Fetch user stats
  const fetchUserStats = useCallback(async () => {
    if (!userId) return;
    setIsLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      setUserStats(data);
    } catch (error) {

      setUserStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [userId]);

  // Audio processing hook
  const {
    handleRecordingComplete,
    audioPlayerRef,
    isPlayingAudio,
    handlePlayAudio,
    handlePauseAudio,
    handleAudioEnded,
    checkAndFixDurations
  } = useAudioProcessing({ onAddRecording, onUpdateRecording });

  // Automatically check for and fix invalid durations in recordings
  useEffect(() => {
    if (recordings?.length > 0) {
      checkAndFixDurations(recordings);
    }
  }, [recordings, checkAndFixDurations]);

  // Realtime sync for recordings only
  useRealtimeSync({
    userId: userId || '',
    onRecordingUpdate: onUpdateRecording,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRecordingDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleReprocessAudioClick = useCallback(async (recording: ClassRecording) => {
    if (!recording.audioUrl || !recording.document_id) {
      toast.error('Audio URL or document ID missing for reprocessing.');
      return;
    }
    toast.info('Reprocessing audio...');
    await onReprocessAudio(recording.audioUrl, recording.document_id);
  }, [onReprocessAudio]);

  const handleDownloadRecording = useCallback((recording: ClassRecording) => {
    if (!recording.audioUrl) {
      toast.info('No audio file to download for this recording.');
      return;
    }
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = `${recording.title || 'recording'}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Recording downloaded!');
  }, []);

  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const handleDeleteRecordingClick = useCallback(async (recording: ClassRecording) => {
    const confirmed = await confirm({
      title: 'Delete Recording',
      description: `Are you sure you want to delete "${recording.title}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (confirmed) {
      await onDeleteRecording(recording.id, recording.document_id || null, recording.audioUrl || null);
      if (selectedRecording?.id === recording.id) {
        setSelectedRecording(null);
        if (isPlayingAudio) {
          handlePauseAudio();
        }
      }
    }
  }, [onDeleteRecording, selectedRecording, isPlayingAudio, handlePauseAudio, confirm]);

  const handleCopyTranscript = useCallback((transcript: string) => {
    if (!transcript) {
      toast.error('No transcript available to copy.');
      return;
    }
    navigator.clipboard.writeText(transcript).then(() => {
      setCopySuccess(true);
      toast.success('Transcript copied to clipboard!');
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {

      toast.error('Failed to copy transcript.');
    });
  }, []);

  // Filter recordings
  const filteredRecordings = recordings.filter(rec =>
    rec.title.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
    rec.subject.toLowerCase().includes(effectiveSearch.toLowerCase())
  );

  // Stats calculation
  const totalDuration = recordings.reduce((acc, rec) => acc + (rec.duration || 0), 0);
  const totalRecordings = recordings.length;

  // Get word count for transcript
  const getWordCount = (text: string) => {
    return text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
  };

  // Audio progress update
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    // Reset progress when selected recording changes
    setAudioProgress(0);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioPlayerRef, selectedRecording]);
  // Sync tab changes with global header
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('section-tab-active', {
      detail: { section: 'recordings', tab: activeTab }
    }));
  }, [activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === 'recordings' && detail?.tab) {
        handleTabChange(detail.tab);
      }
    };
    window.addEventListener('section-tab-change', handler as EventListener);
    return () => window.removeEventListener('section-tab-change', handler as EventListener);
  }, [handleTabChange]);


  return (
    <>
    <div className="min-h-screen bg-transparent max-w-[1440px] mx-auto px-0">
      <audio ref={audioPlayerRef} className="hidden" onEnded={handleAudioEnded} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 relative max-h-screen overflow-y-auto modern-scrollbar">

        {/* Left Sidebar - Stats & Quick Actions */}
        <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen lg:pt-3 overflow-y-auto scrollbar-hide pr-4 modern-scrollbar">
          <div className="space-y-6 w-full max-w-[350px]">

            {/* Stats Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Headphones className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Recordings</h3>
                    <p className="text-sm text-white/80">Your audio library</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Recordings</span>
                  <span className="font-bold text-lg">{totalRecordings}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Duration</span>
                  <span className="font-bold text-lg">{Math.floor(totalDuration / 60)}m</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">This Week</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {recordings.filter(r => {
                      const date = new Date(r.date || r.created_at || '');
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return date > weekAgo;
                    }).length} new
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 p-4">
              <h3 className="font-bold text-lg mb-3 text-blue-900 dark:text-blue-100">Quick Actions</h3>
              <div className="space-y-2">
                <SubscriptionGuard
                  feature="Class Recordings"
                  limitFeature="maxRecordings"
                  currentCount={recordings?.length || 0}
                >
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setActiveTab('record')}
                  >
                    <Mic className="h-4 w-4 mr-2 text-blue-500" /> Record Audio
                  </Button>
                </SubscriptionGuard>
                <SubscriptionGuard
                  feature="Class Recordings"
                  limitFeature="maxRecordings"
                  currentCount={recordings?.length || 0}
                >
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setActiveTab('upload')}
                  >
                    <Upload className="h-4 w-4 mr-2 text-green-500" /> Upload File
                  </Button>
                </SubscriptionGuard>

              </div>
            </div>

            {/* Recent Activity */}
            {recordings.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3">Recent Activity</h3>
                <div className="space-y-3">
                  {recordings.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedRecording(rec);
                        if (isPlayingAudio) handlePauseAudio();
                      }}
                    >
                      <div className={`p-2 rounded-lg ${selectedRecording?.id === rec.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                        <Play className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">{formatRecordingDate(rec.date || rec.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <main className="col-span-1 lg:col-span-5 max-h-screen overflow-y-auto modern-scrollbar pb-20 lg:pb-20 px-2 lg:px-0">

          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl my-4 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl">
            <div className="absolute inset-0 bg-black opacity-10" />
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <Headphones className="h-8 w-8" />
                    <h1 className="text-2xl sm:text-3xl font-bold">Class Recordings</h1>
                  </div>
              </div>
              <p className="text-white/80 text-sm sm:text-base">
                Record lectures, upload audio, and let AI generate notes for you
              </p>
            </div>
          </div>

          {/* Floating Action Buttons */}
          <div className="fixed bottom-16 right-2 lg:bottom-4 lg:right-4 flex flex-col gap-3 z-50">
            {/* Tips Button */}
            {(window as any).__toggleTips && (
              <button
                onClick={() => (window as any).__toggleTips?.()}
                className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
                  animation: 'glow 2s ease-in-out infinite'
                }}
                title="Quick Tips"
              >
                <Lightbulb className="w-6 h-6 fill-current" />
              </button>
            )}
            
            {/* Refresh Button */}
            <Button
              onClick={() => refreshData('recordings')}
              disabled={dataLoading.recordings}
              size="icon"
              className="h-11 w-11 rounded-full shadow-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:shadow-xl transition-all duration-300 border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
            >
              <RefreshCw className={`h-5 w-5 text-blue-600 ${dataLoading.recordings ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={effectiveSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="all" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FileText className="h-4 w-4 mr-2" />
                All Recordings
              </TabsTrigger>
              <TabsTrigger value="record" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm relative">
                <Mic className="h-4 w-4 mr-2" />
                Record
                {isCurrentlyRecording && activeTab !== 'record' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecordingPaused ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </TabsTrigger>
            </TabsList>

            {/* All Recordings Tab */}
            <TabsContent value="all" className="space-y-4 mt-4">
              {filteredRecordings.length === 0 ? (
                <Card className="bg-white dark:bg-slate-900 border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                      <Headphones className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
                    <p className="text-muted-foreground text-center text-sm mb-4 max-w-sm">
                      Start by recording a lecture or uploading an audio file to get AI-powered transcripts and summaries
                    </p>
                    <div className="flex gap-2">
                      <SubscriptionGuard
                        feature="Class Recordings"
                        limitFeature="maxRecordings"
                        currentCount={recordings?.length || 0}
                      >
                        <Button onClick={() => setActiveTab('record')} className="bg-blue-600 hover:bg-blue-700">
                          <Mic className="h-4 w-4 mr-2" /> Start Recording
                        </Button>
                      </SubscriptionGuard>
                      <SubscriptionGuard
                        feature="Class Recordings"
                        limitFeature="maxRecordings"
                        currentCount={recordings?.length || 0}
                      >
                        <Button variant="outline" onClick={() => setActiveTab('upload')}>
                          <Upload className="h-4 w-4 mr-2" /> Upload
                        </Button>
                      </SubscriptionGuard>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRecordings.map((recording) => (
                    <Card
                      key={recording.id}
                      className={`bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-200 cursor-pointer group border-2
                        ${selectedRecording?.id === recording.id
                          ? 'border-blue-500 shadow-lg bg-blue-50/30 dark:bg-blue-900/10'
                          : 'border-slate-100 dark:border-slate-800'}`}
                      onClick={() => {
                        if (selectedRecording?.id !== recording.id && isPlayingAudio) {
                          handlePauseAudio();
                        }
                        setSelectedRecording(selectedRecording?.id === recording.id ? null : recording);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Play Button / Avatar */}
                          <div className="relative">
                            <div className={`p-3 rounded-xl transition-colors ${selectedRecording?.id === recording.id
                              ? 'bg-blue-500 text-white'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50'
                              }`}>
                              {recording.audioUrl ? (
                                <Play className="h-5 w-5" />
                              ) : (
                                <FileText className="h-5 w-5" />
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold truncate text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 pr-2">
                                  {recording.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {recording.subject}
                                  </Badge>
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(recording.duration)}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {formatRecordingDate(recording.date || recording.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    if (selectedRecording?.id !== recording.id && isPlayingAudio) {
                                      handlePauseAudio();
                                    }
                                    setSelectedRecording(recording);
                                  }}
                                  title="View Details"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDownloadRecording(recording)}
                                  disabled={!recording.audioUrl}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-white dark:bg-slate-600">
                                    <DropdownMenuItem onClick={() => {
                                      if (selectedRecording?.id !== recording.id && isPlayingAudio) {
                                        handlePauseAudio();
                                      }
                                      setSelectedRecording(recording);
                                    }}>
                                      <FileText className="h-4 w-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDownloadRecording(recording)}>
                                      <Download className="h-4 w-4 mr-2" /> Download
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteRecordingClick(recording)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Transcript Preview */}
                            {recording.transcript && (
                              <div className="mt-2">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {recording.transcript}
                                </p>
                                {recording.transcript.length > 100 && (
                                  <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">
                                    Show more
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Record Tab - ALWAYS MOUNTED to preserve recording state across tab switches */}
            <div className={`mt-4 ${activeTab === 'record' ? 'block' : 'hidden'}`}>
              {/* Recording-in-background banner */}
              {isCurrentlyRecording && activeTab === 'record' && (
                <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecordingPaused ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                  </span>
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    {isRecordingPaused ? 'Recording paused' : 'Recording in progress'} &mdash; switching tabs won't stop it
                  </span>
                </div>
              )}
              <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <CardContent className="p-6">
                  <SubscriptionGuard
                    feature="Class Recordings"
                    limitFeature="maxRecordings"
                    currentCount={recordings?.length || 0}
                    message="You've reached your recording limit. Upgrade to record more classes."
                  >
                    <EnhancedVoiceRecorder
                      onRecordingComplete={handleRecordingComplete}
                      userId={userId || ''}
                      onRecordingStateChange={handleRecordingStateChange}
                    />
                  </SubscriptionGuard>
                </CardContent>
              </Card>
            </div>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-4">
              <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <CardContent className="p-6">
                  <SubscriptionGuard
                    feature="Class Recordings"
                    limitFeature="maxRecordings"
                    currentCount={recordings?.length || 0}
                    message="You've reached your recording limit. Upgrade to upload more audio files."
                  >
                    <AudioUploadSection onAddRecording={onAddRecording} onUpdateRecording={onUpdateRecording} />
                  </SubscriptionGuard>                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Floating recording indicator when on non-record tabs */}
          {isCurrentlyRecording && activeTab !== 'record' && (
            <button
              onClick={() => setActiveTab('record')}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 lg:bottom-20 z-50 flex items-center gap-2 px-4 py-2.5 
                bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xl transition-all 
                animate-pulse cursor-pointer border-2 border-red-400"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecordingPaused ? 'bg-yellow-300' : 'bg-white'}`}></span>
              </span>
              <Mic className="h-4 w-4" />
              <span className="text-sm font-semibold">
                {isRecordingPaused ? 'Recording Paused' : 'Recording...'}
              </span>
              <span className="text-xs opacity-80">Tap to view</span>
            </button>
          )}
        </main>

        {/* Right Sidebar - Selected Recording Details */}
        <div className="hidden lg:block lg:col-span-4 sticky top-0 lg:pb-20 lg:pt-3">
          <div className="space-y-4 w-full max-w-[400px] max-h-[90vh] overflow-y-auto modern-scrollbar">
            {selectedRecording ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl">
                      <Headphones className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate text-lg">{selectedRecording.title}</h3>
                      <p className="text-sm text-white/80">{selectedRecording.subject}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Audio Player - Enhanced */}
                  {selectedRecording.audioUrl && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <Button
                          size="sm"
                          className="h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600"
                          onClick={() => {
                            if (audioPlayerRef.current && selectedRecording.audioUrl) {
                              if (audioPlayerRef.current.src !== selectedRecording.audioUrl) {
                                audioPlayerRef.current.src = selectedRecording.audioUrl;
                              }
                              isPlayingAudio ? handlePauseAudio() : handlePlayAudio();
                            }
                          }}
                        >
                          {isPlayingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Audio Recording</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{formatDuration(selectedRecording.duration)}</p>
                            {selectedRecording.duration && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                • {Math.floor(selectedRecording.duration / 60)} min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Audio Progress Bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>
                            {audioPlayerRef.current && isFinite(audioPlayerRef.current.currentTime)
                              ? formatDuration(Math.floor(audioPlayerRef.current.currentTime))
                              : '0:00'}
                          </span>
                          <span>{formatDuration(selectedRecording.duration || 0)}</span>
                        </div>
                        <div
                          className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer group"
                          onClick={(e) => {
                            const audio = audioPlayerRef.current;
                            if (!audio || !audio.duration || !isFinite(audio.duration)) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const pct = x / rect.width;
                            audio.currentTime = pct * audio.duration;
                            setAudioProgress(pct * 100);
                          }}
                        >
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-150 group-hover:bg-blue-400"
                            style={{ width: `${audioProgress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content Tabs */}
                  <div className="border-b border-slate-200 dark:border-slate-700">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setActiveContentTab('transcript')}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${activeContentTab === 'transcript'
                          ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clipboard className="h-4 w-4" />
                          Transcript
                          {selectedRecording.transcript && (
                            <span className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">
                              {getWordCount(selectedRecording.transcript)} words
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveContentTab('summary')}
                        className={`px-3 py-2 text-sm font-medium transition-colors ${activeContentTab === 'summary'
                          ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          AI Summary
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Transcript Content */}
                  {activeContentTab === 'transcript' && (
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Clipboard className="h-4 w-4" />
                          Transcript
                        </h4>
                        {selectedRecording.transcript && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyTranscript(selectedRecording.transcript || '')}
                            className="h-6 w-6 p-0"
                            title="Copy Transcript"
                          >
                            {copySuccess ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clipboard className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {selectedRecording.transcript ? (
                        <div className="max-h-60 overflow-y-auto modern-scrollbar">
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {selectedRecording.transcript}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Clipboard className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">No transcript available</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => handleReprocessAudioClick(selectedRecording)}
                          >
                            <RefreshCw className="h-3 w-3 mr-2" />
                            Generate Transcript
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary Content */}
                  {activeContentTab === 'summary' && (
                    <div>
                      {selectedRecording.summary ? (
                        <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg">
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            AI Summary
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {selectedRecording.summary}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">No AI summary available</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => onGenerateNote(selectedRecording)}
                          >
                            <FileText className="h-3 w-3 mr-2" />
                            Generate Summary
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <span className="text-xs text-slate-500">Recorded</span>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {formatRecordingDate(selectedRecording.date || selectedRecording.created_at)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <span className="text-xs text-slate-500">Duration</span>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {formatDuration(selectedRecording.duration)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      onClick={() => onGenerateNote(selectedRecording)}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all duration-200"
                      disabled={!selectedRecording.transcript}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {selectedRecording.transcript ? 'Generate Note' : 'Transcript Needed'}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownloadRecording(selectedRecording)}
                        disabled={!selectedRecording.audioUrl}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleReprocessAudioClick(selectedRecording)}
                        disabled={!selectedRecording.audioUrl}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reprocess
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => handleDeleteRecordingClick(selectedRecording)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Recording
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 text-center">
                <div className="p-4 bg-slate-200 dark:bg-slate-700 rounded-full w-fit mx-auto mb-4">
                  <Headphones className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Select a Recording</h3>
                <p className="text-sm text-muted-foreground">
                  Click on any recording to view details, transcript, and summary
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <ChevronRight className="h-3 w-3" />
                    <span>Click recording cards to view details</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Play className="h-3 w-3" />
                    <span>Play audio directly in the sidebar</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <FileText className="h-3 w-3" />
                    <span>View transcripts and AI summaries</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">💡 Pro Tips</h4>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <li>• Click on any recording to view details</li>
                <li>• Play audio directly from the sidebar</li>
                <li>• Generate notes for better retention</li>
                <li>• Use search to find recordings quickly</li>
                <li>• Download recordings for offline access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Side Panel Overlay */}
      {selectedRecording && (
        <div className='lg:hidden'>
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => {
              setSelectedRecording(null);
              if (isPlayingAudio) handlePauseAudio();
            }}
          />
          <RecordingSidePanel
            recording={selectedRecording}
            onClose={() => {
              setSelectedRecording(null);
              if (isPlayingAudio) handlePauseAudio();
            }}
            onUpdateRecording={onUpdateRecording}
            onGenerateNote={onGenerateNote}
            onReprocessAudio={handleReprocessAudioClick}
            onDeleteRecording={handleDeleteRecordingClick}
            audioUrl={selectedRecording.audioUrl}
            audioPlayerRef={audioPlayerRef}
            isPlayingAudio={isPlayingAudio}
            onPlayAudio={() => {
              if (audioPlayerRef.current && selectedRecording.audioUrl) {
                if (audioPlayerRef.current.src !== selectedRecording.audioUrl) {
                  audioPlayerRef.current.src = selectedRecording.audioUrl;
                }
                handlePlayAudio();
              } else {
                toast.error('No audio available to play.');
              }
            }}
            onPauseAudio={handlePauseAudio}
            onAudioEnded={handleAudioEnded}
          />
        </div>
      )}
    </div>
    {ConfirmDialogComponent}
    </>
  );
};