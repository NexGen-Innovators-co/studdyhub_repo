import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { MarkdownRenderer } from '../ui/MarkDownRendererUi';
import { Button } from '../ui/button';
import {
  Megaphone,
  X,
  ChevronRight,
  Video,
  Link2,
  Sparkles,
  Zap,
  Bug,
  Wrench,
  AlertTriangle,
  Bell,
  Tag,
  ExternalLink,
  Play,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface PlatformUpdate {
  id: string;
  title: string;
  summary: string;
  content: string | null;
  update_type: 'feature' | 'improvement' | 'bugfix' | 'maintenance' | 'announcement' | 'breaking';
  priority: 'low' | 'normal' | 'high' | 'critical';
  video_url: string | null;
  documentation_url: string | null;
  image_url: string | null;
  version_tag: string | null;
  published_at: string | null;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  feature: Sparkles,
  improvement: Zap,
  bugfix: Bug,
  maintenance: Wrench,
  announcement: Megaphone,
  breaking: AlertTriangle,
};

const TYPE_LABEL: Record<string, string> = {
  feature: 'New Feature',
  improvement: 'Improvement',
  bugfix: 'Bug Fix',
  maintenance: 'Maintenance',
  announcement: 'Announcement',
  breaking: 'Breaking Change',
};

const PRIORITY_BANNER_COLORS: Record<string, string> = {
  low: 'from-blue-600/90 to-blue-700/90 border-blue-500/30',
  normal: 'from-blue-600/90 to-indigo-700/90 border-blue-500/30',
  high: 'from-orange-600/90 to-amber-700/90 border-orange-500/30',
  critical: 'from-red-600/90 to-red-700/90 border-red-500/30',
};

// ─── Helper: get YouTube embed URL ──────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v');
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

// ─── Banner Component (shown at top of dashboard) ───────────
export const PlatformUpdateBanner: React.FC = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedUpdate, setSelectedUpdate] = useState<PlatformUpdate | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch published updates + read status
  const fetchUpdates = useCallback(async () => {
    if (!user) return;
    try {
      // Get published updates
      const { data: allUpdates, error: uErr } = await supabase
        .from('platform_updates')
        .select('id, title, summary, content, update_type, priority, video_url, documentation_url, image_url, version_tag, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(20);

      if (uErr) throw uErr;
      if (!allUpdates?.length) { setUpdates([]); setLoading(false); return; }

      // Get which ones the user already dismissed
      const { data: reads } = await supabase
        .from('platform_update_reads')
        .select('update_id')
        .eq('user_id', user.id)
        .eq('dismissed', true);

      const dismissed = new Set((reads || []).map(r => r.update_id));
      setDismissedIds(dismissed);

      // Filter out dismissed
      const visible = allUpdates.filter(u => !dismissed.has(u.id));
      setUpdates(visible);
    } catch (err) {
      console.error('Failed to fetch platform updates:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  // Mark as read
  const markAsRead = async (updateId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('platform_update_reads')
        .upsert({ update_id: updateId, user_id: user.id, read_at: new Date().toISOString(), dismissed: false }, { onConflict: 'update_id,user_id' });
    } catch (err) {
      console.error('Failed to mark update as read:', err);
    }
  };

  // Dismiss
  const dismiss = async (updateId: string) => {
    if (!user) return;
    setUpdates(prev => prev.filter(u => u.id !== updateId));
    try {
      await supabase
        .from('platform_update_reads')
        .upsert({ update_id: updateId, user_id: user.id, read_at: new Date().toISOString(), dismissed: true }, { onConflict: 'update_id,user_id' });
    } catch (err) {
      console.error('Failed to dismiss update:', err);
    }
  };

  // Open detail
  const openDetail = (update: PlatformUpdate) => {
    setSelectedUpdate(update);
    markAsRead(update.id);
  };

  if (loading || updates.length === 0) return null;

  // Show latest update as a banner + badge count for more
  const latest = updates[0];
  const moreCount = updates.length - 1;
  const bannerColor = PRIORITY_BANNER_COLORS[latest.priority] || PRIORITY_BANNER_COLORS.normal;
  const TypeIcon = TYPE_ICON[latest.update_type] || Megaphone;

  return (
    <>
      {/* ─── Banner ─── */}
      <div className={`relative bg-gradient-to-r ${bannerColor} border-b px-4 py-2.5 flex items-center gap-3`}>
        <div className="flex items-center gap-2 shrink-0">
          <Bell className="h-4 w-4 text-white/80 animate-pulse" />
          <TypeIcon className="h-4 w-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">
            <span className="font-bold">{TYPE_LABEL[latest.update_type] || 'Update'}:</span>{' '}
            {latest.summary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openDetail(latest)}
            className="text-white/90 hover:text-white hover:bg-white/20 h-7 px-2 text-xs"
          >
            Read More <ChevronRight className="h-3 w-3 ml-1" />
          </Button>

          {moreCount > 0 && (
            <button
              onClick={() => openDetail(latest)}
              className="bg-white/20 hover:bg-white/30 text-white text-xs rounded-full px-2 py-0.5 font-medium transition-colors"
            >
              +{moreCount} more
            </button>
          )}

          <button
            onClick={() => dismiss(latest.id)}
            className="text-white/60 hover:text-white p-1 rounded transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Detail Modal ─── */}
      {selectedUpdate && (
        <UpdateDetailModal
          update={selectedUpdate}
          allUpdates={updates}
          onClose={() => setSelectedUpdate(null)}
          onSelect={(u) => { setSelectedUpdate(u); markAsRead(u.id); }}
          onDismiss={dismiss}
        />
      )}
    </>
  );
};

// ─── Detail Modal ────────────────────────────────────────────
interface ModalProps {
  update: PlatformUpdate;
  allUpdates: PlatformUpdate[];
  onClose: () => void;
  onSelect: (u: PlatformUpdate) => void;
  onDismiss: (id: string) => void;
}

const UpdateDetailModal: React.FC<ModalProps> = ({ update, allUpdates, onClose, onSelect, onDismiss }) => {
  const TypeIcon = TYPE_ICON[update.update_type] || Megaphone;
  const embedUrl = update.video_url ? getYouTubeEmbedUrl(update.video_url) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <TypeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">{TYPE_LABEL[update.update_type]}</p>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{update.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {update.version_tag && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                <Tag className="h-3 w-3" /> {update.version_tag}
              </span>
            )}
            {update.published_at && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Published {new Date(update.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>

          {/* Summary */}
          <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">{update.summary}</p>

          {/* Banner image */}
          {update.image_url && (
            <img
              src={update.image_url}
              alt={update.title}
              className="w-full rounded-xl object-cover max-h-64"
            />
          )}

          {/* Video embed */}
          {update.video_url && (
            <div className="rounded-xl overflow-hidden bg-black">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={update.title}
                  className="w-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <a
                  href={update.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-4 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Play className="h-8 w-8" />
                  <span className="text-sm">Watch Video</span>
                  <ExternalLink className="h-4 w-4 ml-auto" />
                </a>
              )}
            </div>
          )}

          {/* Markdown content */}
          {update.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={update.content} />
            </div>
          )}

          {/* Documentation link */}
          {update.documentation_url && (
            <a
              href={update.documentation_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
            >
              <Link2 className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-medium text-sm">View Documentation</p>
                <p className="text-xs text-blue-500 dark:text-blue-400/70 truncate">{update.documentation_url}</p>
              </div>
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          {/* Other updates list */}
          {allUpdates.length > 1 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Other Recent Updates</h3>
              <div className="space-y-2">
                {allUpdates
                  .filter(u => u.id !== update.id)
                  .slice(0, 5)
                  .map(u => {
                    const Icon = TYPE_ICON[u.update_type] || Megaphone;
                    return (
                      <button
                        key={u.id}
                        onClick={() => onSelect(u)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left transition-colors group"
                      >
                        <Icon className="h-4 w-4 text-gray-400 group-hover:text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.summary}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-400 shrink-0" />
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onDismiss(update.id); onClose(); }}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlatformUpdateBanner;
