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
  RefreshCw, Loader2, ChevronRight
} from 'lucide-react';
import { ClassRecording } from '../../types/Class';
import { formatDate } from './utils/helpers';
import { VoiceRecorder } from './components/VoiceRecorder';
import { AudioUploadSection } from './components/AudioUploadSection';
import { useAudioProcessing } from './hooks/useAudioProcessing';
import { RecordingSidePanel } from './components/RecordingSidePanel';
import { toast } from 'sonner';
import { useRealtimeSync } from './hooks/useRealTimeSync';
import { supabase } from '../../integrations/supabase/client';
import { UserStats } from '../../types/EnhancedClasses';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ClassRecordingsProps {
  recordings?: ClassRecording[];
  onAddRecording: (recording: ClassRecording) => void;
  onUpdateRecording: (recording: ClassRecording) => void;
  onGenerateNote: (recording: ClassRecording) => Promise<void>;
  onDeleteRecording: (recordingId: string, documentId: string | null, audioUrl: string | null) => Promise<void>;
  onReprocessAudio: (fileUrl: string, documentId: string, targetLang?: string) => Promise<void>;
}

export const ClassRecordings: React.FC<ClassRecordingsProps> = ({
  recordings = [],
  onAddRecording,
  onUpdateRecording,
  onGenerateNote,
  onDeleteRecording,
  onReprocessAudio,
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'record' | 'upload'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      console.error('Error fetching user stats:', error);
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
  } = useAudioProcessing({ onAddRecording, onUpdateRecording });

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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const handleDeleteRecordingClick = useCallback(async (recording: ClassRecording) => {
    if (window.confirm(`Are you sure you want to delete "${recording.title}"? This action cannot be undone.`)) {
      await onDeleteRecording(recording.id, recording.document_id || null, recording.audioUrl || null);
      if (selectedRecording?.id === recording.id) {
        setSelectedRecording(null);
        if (isPlayingAudio) {
          handlePauseAudio();
        }
      }
    }
  }, [onDeleteRecording, selectedRecording, isPlayingAudio, handlePauseAudio]);

  // Filter recordings
  const filteredRecordings = recordings.filter(rec =>
    rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculation
  const totalDuration = recordings.reduce((acc, rec) => acc + (rec.duration || 0), 0);
  const totalRecordings = recordings.length;

  return (
    <div className="min-h-screen bg-transparent max-w-[1240px] mx-auto px-0">
      <audio ref={audioPlayerRef} className="hidden" onEnded={handleAudioEnded} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 relative max-h-screen overflow-y-auto modern-scrollbar">
        
        {/* Left Sidebar - Stats & Quick Actions */}
        <div className="hidden lg:block lg:col-span-3 sticky top-0 h-screen lg:pt-3 overflow-y-auto scrollbar-hide pr-4 modern-scrollbar">
          <div className="space-y-6 w-full max-w-[350px]">
            
            {/* Stats Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4">
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
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
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
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white dark:bg-slate-800"
                  onClick={() => setActiveTab('record')}
                >
                  <Mic className="h-4 w-4 mr-2 text-emerald-500" /> Record New
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white dark:bg-slate-800"
                  onClick={() => setActiveTab('upload')}
                >
                  <Upload className="h-4 w-4 mr-2 text-blue-500" /> Upload Audio
                </Button>
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
                      onClick={() => setSelectedRecording(rec)}
                    >
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Play className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
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
        <main className="col-span-1 lg:col-span-6 max-h-screen overflow-y-auto modern-scrollbar pb-20 lg:pb-20 px-2 lg:px-0">
          
          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl my-4 p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl">
            <div className="absolute inset-0 bg-black opacity-10" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Headphones className="h-8 w-8" />
                <h1 className="text-2xl sm:text-3xl font-bold">Class Recordings</h1>
              </div>
              <p className="text-white/80 text-sm sm:text-base">
                Record lectures, upload audio, and let AI generate notes for you
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
            <TabsList className="w-full bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="all" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FileText className="h-4 w-4 mr-2" />
                All Recordings
              </TabsTrigger>
              <TabsTrigger value="record" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Mic className="h-4 w-4 mr-2" />
                Record
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
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4">
                      <Headphones className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No recordings yet</h3>
                    <p className="text-muted-foreground text-center text-sm mb-4 max-w-sm">
                      Start by recording a lecture or uploading an audio file to get AI-powered transcripts and summaries
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => setActiveTab('record')} className="bg-emerald-600 hover:bg-emerald-700">
                        <Mic className="h-4 w-4 mr-2" /> Start Recording
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('upload')}>
                        <Upload className="h-4 w-4 mr-2" /> Upload
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRecordings.map((recording) => (
                    <Card
                      key={recording.id}
                      className={`bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-200 cursor-pointer group
                        ${selectedRecording?.id === recording.id ? 'ring-2 ring-emerald-500 shadow-lg' : 'border-slate-100 dark:border-slate-800'}`}
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
                            <div className={`p-3 rounded-xl transition-colors ${
                              selectedRecording?.id === recording.id 
                                ? 'bg-emerald-500 text-white' 
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50'
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
                              <div>
                                <h3 className="font-semibold text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {recording.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
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
                                  <DropdownMenuContent align="end">
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
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {recording.transcript}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Record Tab */}
            <TabsContent value="record" className="mt-4">
              <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <CardContent className="p-6">
                  <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-4">
              <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <CardContent className="p-6">
                  <AudioUploadSection onAddRecording={onAddRecording} onUpdateRecording={onUpdateRecording} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Right Sidebar - Selected Recording Details */}
        <div className="hidden lg:block lg:col-span-3 sticky top-0 lg:pb-20 lg:pt-3">
          <div className="space-y-4 w-full max-w-[350px] max-h-[90vh] overflow-y-auto modern-scrollbar">
            {selectedRecording ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4">
                  <h3 className="font-bold text-white truncate">{selectedRecording.title}</h3>
                  <p className="text-sm text-white/80">{selectedRecording.subject}</p>
                </div>
                <div className="p-4 space-y-4">
                  {/* Audio Player */}
                  {selectedRecording.audioUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <Button
                        size="sm"
                        className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600"
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
                        <p className="text-xs text-muted-foreground">{formatDuration(selectedRecording.duration)}</p>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selectedRecording.summary && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Summary</h4>
                      <p className="text-sm text-muted-foreground line-clamp-4">{selectedRecording.summary}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onGenerateNote(selectedRecording)}
                    >
                      <FileText className="h-4 w-4 mr-2" /> Generate Note
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadRecording(selectedRecording)}
                      disabled={!selectedRecording.audioUrl}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 text-center">
                <div className="p-4 bg-slate-200 dark:bg-slate-700 rounded-full w-fit mx-auto mb-4">
                  <Headphones className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No Recording Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Click on a recording to view details and play audio
                </p>
              </div>
            )}

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">💡 Pro Tips</h4>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <li>• Record in a quiet environment</li>
                <li>• Keep recordings under 30 minutes</li>
                <li>• Generate notes for better retention</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Side Panel Overlay */}
      {selectedRecording && (
        <>
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
        </>
      )}
    </div>
  );
};
