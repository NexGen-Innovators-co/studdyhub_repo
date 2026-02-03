import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Podcast, Play, Download, Clock, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';


interface AudioSegment {
  speaker: string;
  audioContent: string;
  text: string;
  index: number;
  audio_url?: string; // For live podcasts stored in storage
}

interface PodcastData {
  id: string;
  title: string;
  script?: string;
  audio_segments?: AudioSegment[];
  duration: number | string;
  sources?: string[];
  style: string;
  created_at: string;
  podcastType?: 'audio' | 'image-audio' | 'video' | 'live-stream';
  visualAssets?: Array<{
    type: 'image' | 'video';
    concept: string;
    description: string;
    url: string;
    timestamp: number;
  }>;
  cover_image_url?: string; // Optional cover image
  is_live?: boolean; // Whether podcast is live
  description?: string; // Optional description
  tags?: string[]; // Optional tags
  listen_count?: number; // Optional listen count
}

export const RecentPodcasts: React.FC = () => {
  const [podcasts, setPodcasts] = useState<PodcastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentPodcasts();
  }, []);

  const fetchRecentPodcasts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_podcasts')
        .select(`
          id,
          title,
          duration_minutes,
          style,
          created_at,
          cover_image_url,
          description,
          listen_count
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Transform data to match PodcastData interface
      const transformedData = (data || []).map(podcast => ({
        ...podcast,
        duration: podcast.duration_minutes || 0,
        // audio_segments intentionally omitted for lightweight dashboard
      }));

      setPodcasts(transformedData);
    } catch (error: any) {
      // // console.warn('[RecentPodcasts] fetch error', error);
      toast.error('Failed to load recent podcasts');
    } finally {
      setLoading(false);
    }
  };

  const playPodcast = async (podcast: PodcastData) => {
    if (playing === podcast.id) {
      setPlaying(null);
      return;
    }

    try {
      setPlaying(podcast.id);
      // Lazy-load full-data fetcher to avoid bundling heavy hook code into dashboard
      const mod = await import('@/hooks/usePodcasts');
      const full = await mod.fetchFullPodcastData(podcast.id);
      if (!full || !full.audioSegments || full.audioSegments.length === 0) {
        toast.error('No audio available for this podcast');
        setPlaying(null);
        return;
      }

      const firstSegment = full.audioSegments[0];
      let audio: HTMLAudioElement;
      if (firstSegment.audio_url) {
        audio = new Audio(firstSegment.audio_url);
      } else if (firstSegment.audioContent) {
        const audioBlob = await fetch(`data:audio/mp3;base64,${firstSegment.audioContent}`).then(r => r.blob());
        const audioUrl = URL.createObjectURL(audioBlob);
        audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
      } else {
        toast.error('Audio segment has no playable source');
        setPlaying(null);
        return;
      }

      audio.onended = () => setPlaying(null);
      audio.play();
    } catch (error: any) {
      toast.error('Failed to play podcast');
      setPlaying(null);
    }
  };

  const downloadPodcast = async (podcast: PodcastData) => {
    try {
      toast.info('Preparing download...');

      // Fetch full podcast data (audio segments) on-demand
      const mod = await import('@/hooks/usePodcasts');
      const full = await mod.fetchFullPodcastData(podcast.id);
      if (!full || !full.audioSegments || full.audioSegments.length === 0) {
        toast.error('No audio available for download');
        return;
      }

      // Combine all audio segments
      const audioBuffers = await Promise.all(
        full.audioSegments.map(async (segment) => {
          if (segment.audio_url) {
            const r = await fetch(segment.audio_url);
            return r.arrayBuffer();
          }
          const response = await fetch(`data:audio/mp3;base64,${segment.audioContent}`);
          return response.arrayBuffer();
        })
      );

      // Concatenate audio buffers
      const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      audioBuffers.forEach(buf => {
        combined.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      });

      // Create download
      const blob = new Blob([combined], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${podcast.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Podcast downloaded!');
    } catch (error: any) {
      toast.error('Failed to download podcast');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Podcast className="h-6 w-6 text-purple-600" />
            Recent AI Podcasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (podcasts.length === 0) {
    return (
      <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Podcast className="h-6 w-6 text-purple-600" />
            Recent AI Podcasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-full flex items-center justify-center">
              <Podcast className="h-8 w-8 text-purple-600 dark:text-purple-300" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No podcasts yet</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Generate AI podcasts from your notes and documents
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Podcast className="h-6 w-6 text-purple-600" />
          Recent AI Podcasts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {podcasts.map((podcast) => (
            <div
              key={podcast.id}
              className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate mb-1">
                    <button
                      onClick={() => navigate(`/podcast/${podcast.id}`)}
                      className="text-left w-full truncate focus:outline-none"
                    >
                      {podcast.title}
                    </button>
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(podcast.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {podcast.duration}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs">
                      {podcast.style}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playPodcast(podcast)}
                    className="h-8 w-8 p-0 hover:bg-purple-100 dark:hover:bg-purple-900"
                  >
                    {playing === podcast.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    ) : (
                      <Play className="h-4 w-4 text-purple-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadPodcast(podcast)}
                    className="h-8 w-8 p-0 hover:bg-purple-100 dark:hover:bg-purple-900"
                  >
                    <Download className="h-4 w-4 text-purple-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

