import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, supabaseUrl } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { MarkdownRenderer } from '../ui/MarkDownRendererUi';
import {
  Sparkles,
  Send,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Loader2,
  Bot,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
} from 'lucide-react';

interface PlatformSnapshot {
  users: { total: number; active7d: number; active30d: number; newToday: number };
  content: { posts: number; comments: number; notes: number; documents: number; groups: number; podcasts: number; chatSessions: number; quizzes: number };
  moderation: { pendingReports: number; pendingModeration: number };
  errors: { last24h: number; criticalLast24h: number; topSources: { source: string; count: number }[] };
  growth: { usersThisWeek: number; usersLastWeek: number; postsThisWeek: number; postsLastWeek: number };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { label: 'Platform Health Check', icon: Shield, prompt: 'Give me a comprehensive health check of the platform. Analyze user engagement, content growth, error rates, and moderation queue. Highlight anything that needs immediate attention.' },
  { label: 'Growth Analysis', icon: TrendingUp, prompt: 'Analyze user growth trends and content creation patterns. Compare this week vs last week. What\'s growing, what\'s declining? Give specific recommendations to improve growth.' },
  { label: 'Error Patterns', icon: AlertTriangle, prompt: 'Analyze the recent system errors. What are the most common failure points? Which components need attention? Suggest priority fixes.' },
  { label: 'Engagement Ideas', icon: Lightbulb, prompt: 'Based on the platform data, suggest 5 actionable strategies to increase user engagement and retention. Consider the content mix, social features, and AI features usage.' },
  { label: 'Performance Report', icon: BarChart3, prompt: 'Generate a concise executive summary report of platform performance. Include key metrics, trends, and recommended actions. Format it like a weekly report I could share with stakeholders.' },
  { label: 'Feature Usage', icon: Zap, prompt: 'Analyze which features (podcasts, AI chat, quizzes, notes, social) are most and least used. Which features should we promote more? What new features might users want based on their behavior?' },
];

const AIAdminInsights: React.FC = () => {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch platform snapshot for context
  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const day1Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const day14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        totalUsers, active7d, active30d, newToday,
        totalPosts, totalComments, totalNotes, totalDocs, totalGroups, totalPodcasts, totalChats, totalQuizzes,
        pendingReports, pendingModeration,
        errorsLast24h, criticalErrors,
        usersThisWeek, usersLastWeek,
        postsThisWeek, postsLastWeek
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', day7Ago),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', day30Ago),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', now.toISOString().split('T')[0]),
        supabase.from('social_posts').select('*', { count: 'exact', head: true }),
        supabase.from('social_comments').select('*', { count: 'exact', head: true }),
        supabase.from('notes').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('social_groups').select('*', { count: 'exact', head: true }),
        supabase.from('ai_podcasts').select('*', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }),
        supabase.from('social_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('content_moderation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('system_error_logs').select('*', { count: 'exact', head: true }).gte('created_at', day1Ago),
        supabase.from('system_error_logs').select('*', { count: 'exact', head: true }).gte('created_at', day1Ago).eq('severity', 'critical'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day7Ago),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day14Ago).lt('created_at', day7Ago),
        supabase.from('social_posts').select('*', { count: 'exact', head: true }).gte('created_at', day7Ago),
        supabase.from('social_posts').select('*', { count: 'exact', head: true }).gte('created_at', day14Ago).lt('created_at', day7Ago),
      ]);

      // Get top error sources
      const { data: recentErrors } = await supabase
        .from('system_error_logs')
        .select('source')
        .gte('created_at', day1Ago)
        .order('created_at', { ascending: false })
        .limit(100);

      const sourceCounts: Record<string, number> = {};
      (recentErrors || []).forEach((e: any) => {
        sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
      });
      const topSources = Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([source, count]) => ({ source, count }));

      setSnapshot({
        users: {
          total: totalUsers.count || 0,
          active7d: active7d.count || 0,
          active30d: active30d.count || 0,
          newToday: newToday.count || 0,
        },
        content: {
          posts: totalPosts.count || 0,
          comments: totalComments.count || 0,
          notes: totalNotes.count || 0,
          documents: totalDocs.count || 0,
          groups: totalGroups.count || 0,
          podcasts: totalPodcasts.count || 0,
          chatSessions: totalChats.count || 0,
          quizzes: totalQuizzes.count || 0,
        },
        moderation: {
          pendingReports: pendingReports.count || 0,
          pendingModeration: pendingModeration.count || 0,
        },
        errors: {
          last24h: errorsLast24h.count || 0,
          criticalLast24h: criticalErrors.count || 0,
          topSources,
        },
        growth: {
          usersThisWeek: usersThisWeek.count || 0,
          usersLastWeek: usersLastWeek.count || 0,
          postsThisWeek: postsThisWeek.count || 0,
          postsLastWeek: postsLastWeek.count || 0,
        },
      });
    } catch (err) {
      console.error('Failed to fetch platform snapshot:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystemContext = () => {
    if (!snapshot) return '';
    const s = snapshot;
    const engagementRate = s.users.total > 0 ? ((s.users.active7d / s.users.total) * 100).toFixed(1) : '0';
    const userGrowth = s.growth.usersLastWeek > 0
      ? (((s.growth.usersThisWeek - s.growth.usersLastWeek) / s.growth.usersLastWeek) * 100).toFixed(1)
      : 'N/A';
    const postGrowth = s.growth.postsLastWeek > 0
      ? (((s.growth.postsThisWeek - s.growth.postsLastWeek) / s.growth.postsLastWeek) * 100).toFixed(1)
      : 'N/A';

    return `━━━ Users ━━━
• Total users: ${s.users.total}
• Active (7d): ${s.users.active7d} (${engagementRate}% engagement rate)
• Active (30d): ${s.users.active30d}
• New today: ${s.users.newToday}
• New this week: ${s.growth.usersThisWeek} (vs last week: ${s.growth.usersLastWeek}, growth: ${userGrowth}%)

━━━ Content ━━━
• Social posts: ${s.content.posts} (this week: ${s.growth.postsThisWeek}, growth: ${postGrowth}%)
• Comments: ${s.content.comments}
• Notes: ${s.content.notes}
• Documents: ${s.content.documents}
• Study groups: ${s.content.groups}
• AI Podcasts: ${s.content.podcasts}
• AI Chat sessions: ${s.content.chatSessions}
• Quiz attempts: ${s.content.quizzes}

━━━ Moderation ━━━
• Pending reports: ${s.moderation.pendingReports}
• Pending moderation: ${s.moderation.pendingModeration}

━━━ System Health ━━━
• Errors (24h): ${s.errors.last24h}
• Critical errors (24h): ${s.errors.criticalLast24h}
• Top error sources: ${s.errors.topSources.length > 0 ? s.errors.topSources.map(e => `${e.source}(${e.count})`).join(', ') : 'None'}`;
  };

  const generateResponse = async (userMessage: string) => {
    if (!snapshot || isGenerating) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user' as const, content: userMessage, timestamp: new Date() },
    ];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    setShowQuickPrompts(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const systemContext = buildSystemContext();

      // Build conversation history for Gemini
      const conversationHistory = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Call dedicated admin-ai-insights edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          platformData: buildSystemContext(),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.response || data.error || 'No response generated.';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: aiContent, timestamp: new Date() },
      ]);
    } catch (error: any) {
      console.error('AI Admin Insights error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error**: ${error.message || 'Failed to generate insights. Please try again.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    generateResponse(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setShowQuickPrompts(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
            <span className="text-gray-600 dark:text-gray-400">Loading platform data for AI analysis...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Snapshot Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              Engagement Rate
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {snapshot?.users.total ? ((snapshot.users.active7d / snapshot.users.total) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">7-day active / total</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <BarChart3 className="h-4 w-4" />
              Content This Week
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {snapshot?.growth.postsThisWeek || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              posts (last week: {snapshot?.growth.postsLastWeek || 0})
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 ${(snapshot?.errors.criticalLast24h || 0) > 0 ? 'ring-2 ring-red-500/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <AlertTriangle className={`h-4 w-4 ${(snapshot?.errors.criticalLast24h || 0) > 0 ? 'text-red-500' : ''}`} />
              Errors (24h)
            </div>
            <div className={`text-2xl font-bold ${(snapshot?.errors.criticalLast24h || 0) > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {snapshot?.errors.last24h || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {snapshot?.errors.criticalLast24h || 0} critical
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 ${(snapshot?.moderation.pendingReports || 0) > 0 ? 'ring-2 ring-amber-500/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Shield className={`h-4 w-4 ${(snapshot?.moderation.pendingReports || 0) > 0 ? 'text-amber-500' : ''}`} />
              Pending Review
            </div>
            <div className={`text-2xl font-bold ${(snapshot?.moderation.pendingReports || 0) > 0 ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
              {(snapshot?.moderation.pendingReports || 0) + (snapshot?.moderation.pendingModeration || 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">reports + moderation queue</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Interface */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-gray-900 dark:text-white">AI Admin Assistant</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Analyze platform data, get insights, and generate reports
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSnapshot}
                disabled={isGenerating}
                className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Data
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChat}
                  disabled={isGenerating}
                  className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Action Buttons */}
          {showQuickPrompts && messages.length === 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Quick Analysis</p>
                <button
                  onClick={() => setShowQuickPrompts(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => generateResponse(qp.prompt)}
                    disabled={isGenerating}
                    className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-700 transition-all text-left group disabled:opacity-50"
                  >
                    <qp.icon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {qp.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show quick prompts toggle when hidden */}
          {!showQuickPrompts && messages.length === 0 && (
            <button
              onClick={() => setShowQuickPrompts(true)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ChevronDown className="h-4 w-4" />
              Show quick prompts
            </button>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} className="prose dark:prose-invert prose-sm max-w-none" />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                  )}
                </div>
              ))}
              {isGenerating && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing platform data...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about platform metrics, anomalies, or request a report..."
              className="min-h-[44px] max-h-[120px] resize-none bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
              disabled={isGenerating}
              rows={1}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white h-11 px-4"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAdminInsights;
