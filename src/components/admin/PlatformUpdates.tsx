import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { logAdminActivity } from '../../utils/adminActivityLogger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { MarkdownRenderer } from '../ui/MarkDownRendererUi';
import { toast } from 'sonner';
import {
  Megaphone,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Send,
  Clock,
  Archive,
  FileText,
  Video,
  Link2,
  Tag,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Wrench,
  Bug,
  Zap,
  Bell,
  Users,
  BarChart3,
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
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_for: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  read_count?: number;
}

type UpdateFormData = {
  title: string;
  summary: string;
  content: string;
  update_type: PlatformUpdate['update_type'];
  priority: PlatformUpdate['priority'];
  video_url: string;
  documentation_url: string;
  image_url: string;
  version_tag: string;
  status: PlatformUpdate['status'];
  scheduled_for: string;
  expires_at: string;
};

const EMPTY_FORM: UpdateFormData = {
  title: '',
  summary: '',
  content: '',
  update_type: 'feature',
  priority: 'normal',
  video_url: '',
  documentation_url: '',
  image_url: '',
  version_tag: '',
  status: 'draft',
  scheduled_for: '',
  expires_at: '',
};

const TYPE_CONFIG: Record<PlatformUpdate['update_type'], { label: string; icon: React.ElementType; color: string }> = {
  feature: { label: 'New Feature', icon: Sparkles, color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20' },
  improvement: { label: 'Improvement', icon: Zap, color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20' },
  bugfix: { label: 'Bug Fix', icon: Bug, color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/20' },
  breaking: { label: 'Breaking Change', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20' },
};

const PRIORITY_CONFIG: Record<PlatformUpdate['priority'], { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20' },
  normal: { label: 'Normal', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20' },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20' },
  critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20' },
};

const STATUS_CONFIG: Record<PlatformUpdate['status'], { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: Edit3, color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20' },
  archived: { label: 'Archived', icon: Archive, color: 'text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-600/20' },
};

// ─── Component ───────────────────────────────────────────────
const PlatformUpdates: React.FC = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateFormData>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, published: 0, scheduled: 0, drafts: 0 });

  // ─── Fetch ────────────────────────────────────────────────
  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('platform_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch read counts for each update
      const updatesWithCounts = await Promise.all(
        (data || []).map(async (u) => {
          const { count } = await supabase
            .from('platform_update_reads')
            .select('*', { count: 'exact', head: true })
            .eq('update_id', u.id);
          return { ...u, read_count: count || 0 };
        })
      );

      setUpdates(updatesWithCounts);

      // Compute stats
      const all = data || [];
      setStats({
        total: all.length,
        published: all.filter(u => u.status === 'published').length,
        scheduled: all.filter(u => u.status === 'scheduled').length,
        drafts: all.filter(u => u.status === 'draft').length,
      });
    } catch (err: any) {
      console.error('Failed to fetch updates:', err);
      toast.error('Failed to load platform updates');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  // ─── Save / Create ────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error('Title and summary are required');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim() || null,
        update_type: form.update_type,
        priority: form.priority,
        video_url: form.video_url.trim() || null,
        documentation_url: form.documentation_url.trim() || null,
        image_url: form.image_url.trim() || null,
        version_tag: form.version_tag.trim() || null,
        status: form.status,
        scheduled_for: form.scheduled_for || null,
        expires_at: form.expires_at || null,
        updated_by: user.id,
      };

      // Auto-set published_at when publishing
      if (form.status === 'published') {
        payload.published_at = new Date().toISOString();
      }

      if (editingId) {
        const { error } = await supabase
          .from('platform_updates')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Update saved');
        logAdminActivity({ action: 'edit_platform_update', target_type: 'platform_updates', target_id: editingId, details: { title: form.title, status: form.status } });
      } else {
        payload.created_by = user.id;
        const { error } = await supabase
          .from('platform_updates')
          .insert(payload);
        if (error) throw error;
        toast.success('Update created');
        logAdminActivity({ action: 'create_platform_update', target_type: 'platform_updates', details: { title: form.title, status: form.status, type: form.update_type } });
      }

      resetForm();
      fetchUpdates();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save update');
    } finally {
      setSaving(false);
    }
  };

  // ─── Quick Publish ────────────────────────────────────────
  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase
        .from('platform_updates')
        .update({ status: 'published', published_at: new Date().toISOString(), updated_by: user?.id })
        .eq('id', id);
      if (error) throw error;
      toast.success('Update published!');
      logAdminActivity({ action: 'publish_platform_update', target_type: 'platform_updates', target_id: id });
      fetchUpdates();
    } catch (err: any) {
      toast.error('Failed to publish');
    }
  };

  // ─── Archive ──────────────────────────────────────────────
  const handleArchive = async (id: string) => {
    try {
      const { error } = await supabase
        .from('platform_updates')
        .update({ status: 'archived', updated_by: user?.id })
        .eq('id', id);
      if (error) throw error;
      toast.success('Update archived');
      logAdminActivity({ action: 'archive_platform_update', target_type: 'platform_updates', target_id: id });
      fetchUpdates();
    } catch (err: any) {
      toast.error('Failed to archive');
    }
  };

  // ─── Delete ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this update permanently?')) return;
    try {
      const { error } = await supabase
        .from('platform_updates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Update deleted');
      logAdminActivity({ action: 'delete_platform_update', target_type: 'platform_updates', target_id: id });
      fetchUpdates();
    } catch (err: any) {
      toast.error('Failed to delete');
    }
  };

  // ─── Edit ─────────────────────────────────────────────────
  const startEdit = (u: PlatformUpdate) => {
    setEditingId(u.id);
    setForm({
      title: u.title,
      summary: u.summary,
      content: u.content || '',
      update_type: u.update_type,
      priority: u.priority,
      video_url: u.video_url || '',
      documentation_url: u.documentation_url || '',
      image_url: u.image_url || '',
      version_tag: u.version_tag || '',
      status: u.status,
      scheduled_for: u.scheduled_for ? u.scheduled_for.slice(0, 16) : '',
      expires_at: u.expires_at ? u.expires_at.slice(0, 16) : '',
    });
    setShowForm(true);
    setPreviewMode(false);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setPreviewMode(false);
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            Platform Updates
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create and manage announcements, changelogs, and feature updates for users
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Update
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Published', value: stats.published, color: 'text-green-600 dark:text-green-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Drafts', value: stats.drafts, color: 'text-gray-500 dark:text-gray-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'scheduled', 'published', 'archived'].map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
            className={filterStatus === status
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* ─── Create/Edit Form ──────────────────────────────── */}
      {showForm && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 dark:text-white">
                {editingId ? 'Edit Update' : 'Create New Update'}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {previewMode ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  <span className="hidden sm:inline">{previewMode ? 'Edit' : 'Preview'}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewMode ? (
              /* ─── Preview Mode ─── */
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                  {form.update_type && (() => {
                    const tc = TYPE_CONFIG[form.update_type];
                    const Icon = tc.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
                        <Icon className="h-3 w-3" /> {tc.label}
                      </span>
                    );
                  })()}
                  {form.version_tag && (
                    <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      <Tag className="h-3 w-3 inline mr-1" />{form.version_tag}
                    </span>
                  )}
                  {form.priority !== 'normal' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[form.priority].color}`}>
                      {PRIORITY_CONFIG[form.priority].label} Priority
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{form.title || 'Untitled'}</h3>
                <p className="text-gray-600 dark:text-gray-300">{form.summary || 'No summary'}</p>
                {form.content && (
                  <div className="mt-4 prose dark:prose-invert max-w-none">
                    <MarkdownRenderer content={form.content} />
                  </div>
                )}
                {form.video_url && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                    <Video className="h-4 w-4" /> <a href={form.video_url} target="_blank" rel="noreferrer" className="hover:underline truncate">{form.video_url}</a>
                  </div>
                )}
                {form.documentation_url && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                    <Link2 className="h-4 w-4" /> <a href={form.documentation_url} target="_blank" rel="noreferrer" className="hover:underline truncate">{form.documentation_url}</a>
                  </div>
                )}
              </div>
            ) : (
              /* ─── Edit Mode ─── */
              <>
                {/* Row 1: Title + Version */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. New AI Podcast Generator v2"
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Version Tag</label>
                    <Input
                      value={form.version_tag}
                      onChange={e => setForm(f => ({ ...f, version_tag: e.target.value }))}
                      placeholder="e.g. v2.5.0"
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* Row 2: Summary */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Summary * <span className="text-gray-400 dark:text-gray-500">(shown in user banner)</span></label>
                  <Input
                    value={form.summary}
                    onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Brief description shown in the notification banner"
                    maxLength={200}
                    className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{form.summary.length}/200</p>
                </div>

                {/* Row 3: Type + Priority + Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
                    <select
                      value={form.update_type}
                      onChange={e => setForm(f => ({ ...f, update_type: e.target.value as any }))}
                      className="w-full rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}
                      className="w-full rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                      className="w-full rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Full Content (Markdown) */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Full Content <span className="text-gray-400 dark:text-gray-500">(Markdown supported — changelog, docs, etc.)</span>
                  </label>
                  <Textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={"## What's New\n\n- Feature 1: ...\n- Feature 2: ...\n\n## How to Use\n\n..."}
                    rows={8}
                    className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-mono text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>

                {/* Row 5: Media links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <Video className="h-3 w-3 inline mr-1" /> Video URL
                    </label>
                    <Input
                      value={form.video_url}
                      onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=..."
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <Link2 className="h-3 w-3 inline mr-1" /> Documentation URL
                    </label>
                    <Input
                      value={form.documentation_url}
                      onChange={e => setForm(f => ({ ...f, documentation_url: e.target.value }))}
                      placeholder="https://docs.studdyhub.com/..."
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* Row 6: Image + Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Banner Image URL</label>
                    <Input
                      value={form.image_url}
                      onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://..."
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <Clock className="h-3 w-3 inline mr-1" /> Schedule For
                    </label>
                    <Input
                      type="datetime-local"
                      value={form.scheduled_for}
                      onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))}
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Row 7: Expires */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Expires At <span className="text-gray-400 dark:text-gray-500">(optional)</span></label>
                    <Input
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                      className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {editingId ? 'Save Changes' : form.status === 'published' ? 'Publish Now' : 'Save'}
              </Button>
              <Button variant="outline" onClick={resetForm} className="bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Updates List ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-500 dark:text-blue-400 animate-spin" />
        </div>
      ) : updates.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No updates found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Create your first platform update to notify users</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map(u => {
            const tc = TYPE_CONFIG[u.update_type];
            const sc = STATUS_CONFIG[u.status];
            const TypeIcon = tc.icon;
            const StatusIcon = sc.icon;
            const isExpanded = expandedId === u.id;

            return (
              <Card key={u.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tc.color}`}>
                          <TypeIcon className="h-3 w-3" /> {tc.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                        {u.priority !== 'normal' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[u.priority].color}`}>
                            {PRIORITY_CONFIG[u.priority].label}
                          </span>
                        )}
                        {u.version_tag && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {u.version_tag}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">{u.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{u.summary}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      {u.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePublish(u.id)}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/10 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                          title="Publish"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {u.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(u.id)}
                          className="text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/10 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(u)}
                        className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(u.id)}
                        className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                    <span>Created {new Date(u.created_at).toLocaleDateString()}</span>
                    {u.published_at && <span className="hidden sm:inline">Published {new Date(u.published_at).toLocaleDateString()}</span>}
                    {u.scheduled_for && u.status === 'scheduled' && (
                      <span className="text-yellow-600 dark:text-yellow-400">
                        <Clock className="h-3 w-3 inline mr-0.5" />
                        <span className="hidden sm:inline">Scheduled: </span>{new Date(u.scheduled_for).toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {u.read_count || 0} reads
                    </span>
                    {u.video_url && <Video className="h-3 w-3 text-blue-500 dark:text-blue-400" title="Has video" />}
                    {u.documentation_url && <Link2 className="h-3 w-3 text-blue-500 dark:text-blue-400" title="Has docs" />}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      {u.content && (
                        <div className="prose dark:prose-invert max-w-none text-sm">
                          <MarkdownRenderer content={u.content} />
                        </div>
                      )}
                      {u.video_url && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 min-w-0">
                          <Video className="h-4 w-4 shrink-0" />
                          <a href={u.video_url} target="_blank" rel="noreferrer" className="hover:underline truncate">{u.video_url}</a>
                        </div>
                      )}
                      {u.documentation_url && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 min-w-0">
                          <Link2 className="h-4 w-4 shrink-0" />
                          <a href={u.documentation_url} target="_blank" rel="noreferrer" className="hover:underline truncate">{u.documentation_url}</a>
                        </div>
                      )}
                      {u.image_url && (
                        <img src={u.image_url} alt="Update banner" className="rounded-lg max-h-48 w-full object-cover" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlatformUpdates;
