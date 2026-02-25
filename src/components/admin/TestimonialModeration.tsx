// src/components/admin/TestimonialModeration.tsx
// Admin panel for reviewing, approving, and rejecting user testimonials.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { logAdminActivity } from '../../utils/adminActivityLogger';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import {
  Star,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  User,
  RefreshCw,
  Trash2,
  Filter,
  BarChart3,
} from 'lucide-react';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

interface Testimonial {
  id: string;
  user_id: string;
  content: string;
  rating: number;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  // Joined profile data
  full_name?: string;
  avatar_url?: string;
}

const TestimonialModeration: React.FC = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });

  useEffect(() => {
    fetchTestimonials();
    fetchStats();
  }, [filter]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('app_testimonials')
        .select('is_approved');

      if (error) throw error;
      const all = data || [];
      setStats({
        pending: all.filter(t => !t.is_approved).length,
        approved: all.filter(t => t.is_approved).length,
        total: all.length,
      });
    } catch {
      // silent
    }
  };

  const fetchTestimonials = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('app_testimonials')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('is_approved', false);
      } else if (filter === 'approved') {
        query = query.eq('is_approved', true);
      }
      // 'all' and 'rejected' handled below

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];

      // Fetch profile data for all users
      const userIds = [...new Set(items.map(t => t.user_id))];
      let profileMap = new Map<string, { full_name: string; avatar_url: string }>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profileMap = new Map(profiles.map(p => [p.id, { full_name: p.full_name || '', avatar_url: p.avatar_url || '' }]));
        }
      }

      const enriched: Testimonial[] = items.map(t => ({
        ...t,
        full_name: profileMap.get(t.user_id)?.full_name || 'Unknown User',
        avatar_url: profileMap.get(t.user_id)?.avatar_url || '',
      }));

      setTestimonials(enriched);
    } catch (err: any) {
      toast.error(`Failed to load testimonials: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('app_testimonials')
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Testimonial approved and published');
      logAdminActivity({ action: 'approve_testimonial', target_type: 'app_testimonials', target_id: id });
      // Update local state
      setTestimonials(prev =>
        filter === 'pending'
          ? prev.filter(t => t.id !== id)
          : prev.map(t => t.id === id ? { ...t, is_approved: true } : t)
      );
      setStats(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
    } catch (err: any) {
      toast.error(`Failed to approve: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('app_testimonials')
        .update({ is_approved: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Testimonial rejected');
      logAdminActivity({ action: 'reject_testimonial', target_type: 'app_testimonials', target_id: id });
      setTestimonials(prev =>
        filter === 'approved'
          ? prev.filter(t => t.id !== id)
          : prev.map(t => t.id === id ? { ...t, is_approved: false } : t)
      );
      setStats(prev => ({ ...prev, pending: prev.pending + 1, approved: prev.approved - 1 }));
    } catch (err: any) {
      toast.error(`Failed to reject: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this testimonial? This cannot be undone.')) return;

    setActionLoading(id);
    try {
      const item = testimonials.find(t => t.id === id);
      const { error } = await supabase
        .from('app_testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Testimonial deleted');
      logAdminActivity({ action: 'delete_testimonial', target_type: 'app_testimonials', target_id: id });
      setTestimonials(prev => prev.filter(t => t.id !== id));
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        pending: item && !item.is_approved ? prev.pending - 1 : prev.pending,
        approved: item && item.is_approved ? prev.approved - 1 : prev.approved,
      }));
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );

  const filterButtons: { key: StatusFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4" /> },
    { key: 'approved', label: 'Approved', icon: <CheckCircle className="h-4 w-4" /> },
    { key: 'all', label: 'All', icon: <Filter className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            Testimonial Moderation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review and approve user testimonials for the landing page
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchTestimonials(); fetchStats(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-yellow-200 dark:border-yellow-800/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.approved}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Testimonials</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filterButtons.map(({ key, label, icon }) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(key)}
            className="gap-1.5"
          >
            {icon}
            {label}
            {key === 'pending' && stats.pending > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] text-xs">
                {stats.pending}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Testimonial List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-1/4 mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : testimonials.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              No {filter !== 'all' ? filter : ''} testimonials
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'pending'
                ? 'All testimonials have been reviewed!'
                : 'No testimonials submitted yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {testimonials.map(t => (
            <Card
              key={t.id}
              className={`transition-all ${
                !t.is_approved
                  ? 'border-yellow-200 dark:border-yellow-800/40'
                  : 'border-green-200 dark:border-green-800/40'
              }`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Author + Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                        {t.avatar_url ? (
                          <img src={t.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{t.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.created_at)}</p>
                      </div>
                      <Badge
                        className={`ml-auto sm:ml-2 text-xs ${
                          t.is_approved
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {t.is_approved ? 'Published' : 'Pending'}
                      </Badge>
                    </div>

                    {renderStars(t.rating)}

                    <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm leading-relaxed">
                      "{t.content}"
                    </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    {!t.is_approved && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(t.id)}
                        disabled={actionLoading === t.id}
                        className="gap-1.5 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    {t.is_approved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(t.id)}
                        disabled={actionLoading === t.id}
                        className="gap-1.5 text-yellow-600 border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      >
                        <XCircle className="h-4 w-4" />
                        Unpublish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(t.id)}
                      disabled={actionLoading === t.id}
                      className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestimonialModeration;
