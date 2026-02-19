// supabase/functions/utils/subscription-validator.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SubscriptionData {
  subscription_tier: 'free' | 'scholar' | 'genius';
  maxNotes?: number;
  maxDocUploads?: number;
  maxRecordings?: number;
  maxFolders?: number;
  maxScheduleItems?: number;
  maxDailyQuizzes?: number;
  maxAiMessages?: number;
  canPostSocials?: boolean;
  canAccessSocial?: boolean;
}

interface ValidationResult {
  allowed: boolean;
  message?: string;
  currentUsage?: number;
  limit?: number;
}

export class SubscriptionValidator {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Check if user is an admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  }

  /**
   * Get user's subscription data
   */
  async getUserSubscription(userId: string): Promise<SubscriptionData> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // console.error('Error fetching subscription:', error);
      // Default to free tier
      return { subscription_tier: 'free' };
    }

    return data || { subscription_tier: 'free' };
  }

  /**
   * Check if user can post on social
   */
  async canPostSocial(userId: string): Promise<ValidationResult> {
    // Admins have full access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    
    // Only scholar and genius can post
    if (subscription.subscription_tier === 'free') {
      return {
        allowed: false,
        message: 'Social posting is only available for Scholar and Genius plans. Upgrade to share your thoughts!'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can create groups
   */
  async canCreateGroup(userId: string): Promise<ValidationResult> {
    // Admins have full access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    
    // Only scholar and genius can create groups
    if (subscription.subscription_tier === 'free') {
      return {
        allowed: false,
        message: 'Study groups are only available for Scholar and Genius plans.'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can chat/message
   */
  async canChat(userId: string): Promise<ValidationResult> {
    // Admins have full access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    
    // Only scholar and genius can chat
    if (subscription.subscription_tier === 'free') {
      return {
        allowed: false,
        message: 'Messaging is only available for Scholar and Genius plans.'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can access community features
   */
  async canAccessCommunity(userId: string): Promise<ValidationResult> {
    // Admins have full access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    
    // Only scholar and genius have community access
    if (subscription.subscription_tier === 'free') {
      return {
        allowed: false,
        message: 'Community features are only available for Scholar and Genius plans.'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user exceeded daily AI message limit
   */
  async checkAiMessageLimit(userId: string): Promise<ValidationResult> {
    // Admins have unlimited access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const maxMessages = subscription.maxAiMessages || 5;

    if (subscription.subscription_tier === 'free') {
      const today = new Date().toISOString().split('T')[0];
      
      const { count, error } = await this.supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'assistant')
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`);

      if (error) {
        // console.error('Error counting messages:', error);
        return { allowed: true }; // Allow on error to not break user experience
      }

      const currentCount = count || 0;
      if (currentCount >= maxMessages) {
        return {
          allowed: false,
          message: `Daily AI message limit reached (${maxMessages}). You have sent ${currentCount} messages today.`,
          currentUsage: currentCount,
          limit: maxMessages
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get AI model configuration based on user's subscription tier.
   * Returns the prioritized model chain and a display label.
   */
  async getAiModelConfig(userId: string): Promise<{
    tier: 'free' | 'scholar' | 'genius';
    modelChain: string[];
    streamingChain: string[];
    displayLabel: string;
  }> {
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return {
        tier: 'genius',
        modelChain: [
          'gemini-2.5-pro',
          'gemini-3-pro-preview',
          'gemini-2.5-flash',
          'gemini-2.0-pro',
          'gemini-2.0-flash',
          'gemini-1.5-pro',
        ],
        streamingChain: ['gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-2.5-flash'],
        displayLabel: 'Gemini Pro',
      };
    }

    const subscription = await this.getUserSubscription(userId);

    switch (subscription.subscription_tier) {
      case 'genius':
        return {
          tier: 'genius',
          modelChain: [
            'gemini-2.5-pro',
            'gemini-3-pro-preview',
            'gemini-2.5-flash',
            'gemini-2.0-pro',
            'gemini-2.0-flash',
            'gemini-1.5-pro',
          ],
          streamingChain: ['gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-2.5-flash'],
          displayLabel: 'Gemini Pro',
        };
      case 'scholar':
        return {
          tier: 'scholar',
          modelChain: [
            'gemini-2.5-flash',
            'gemini-3-pro-preview',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-2.5-pro',
            'gemini-2.0-pro',
          ],
          streamingChain: ['gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-2.0-flash'],
          displayLabel: 'Gemini 2.5 Flash',
        };
      default:
        return {
          tier: 'free',
          modelChain: [
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
          ],
          streamingChain: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'],
          displayLabel: 'Gemini Flash',
        };
    }
  }

  /**
   * Check if user exceeded notes limit
   */
  async checkNotesLimit(userId: string): Promise<ValidationResult> {
    // Admins have unlimited access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const maxNotes = subscription.maxNotes || 50;

    if (subscription.subscription_tier === 'free') {
      const { count, error } = await this.supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        // console.error('Error counting notes:', error);
        return { allowed: true };
      }

      const currentCount = count || 0;
      if (currentCount >= maxNotes) {
        return {
          allowed: false,
          message: `Note limit reached (${maxNotes}). You have created ${currentCount} notes.`,
          currentUsage: currentCount,
          limit: maxNotes
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if user exceeded documents limit
   */
  async checkDocumentsLimit(userId: string, fileSize?: number): Promise<ValidationResult> {
    // Admins have unlimited access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const maxDocuments = subscription.maxDocUploads || 50;
    const maxSizeMB = subscription.maxDocUploads === 50 ? 5 : 50; // Rough estimate

    // Check file size if provided
    if (fileSize && subscription.subscription_tier === 'free') {
      const sizeMB = fileSize / (1024 * 1024);
      if (sizeMB > 5) {
        return {
          allowed: false,
          message: `File size ${sizeMB.toFixed(2)}MB exceeds limit of 5MB for free tier.`
        };
      }
    }

    if (subscription.subscription_tier === 'free') {
      const { count, error } = await this.supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        // console.error('Error counting documents:', error);
        return { allowed: true };
      }

      const currentCount = count || 0;
      if (currentCount >= maxDocuments) {
        return {
          allowed: false,
          message: `Document limit reached (${maxDocuments}). You have uploaded ${currentCount} documents.`,
          currentUsage: currentCount,
          limit: maxDocuments
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if user exceeded recordings limit
   */
  async checkRecordingsLimit(userId: string): Promise<ValidationResult> {
    // Admins have unlimited access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const maxRecordings = subscription.maxRecordings || 50;

    if (subscription.subscription_tier === 'free') {
      const { count, error } = await this.supabase
        .from('class_recordings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        // console.error('Error counting recordings:', error);
        return { allowed: true };
      }

      const currentCount = count || 0;
      if (currentCount >= maxRecordings) {
        return {
          allowed: false,
          message: `Recording limit reached (${maxRecordings}). You have created ${currentCount} recordings.`,
          currentUsage: currentCount,
          limit: maxRecordings
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check daily quiz limit
   */
  async checkDailyQuizLimit(userId: string): Promise<ValidationResult> {
    // Admins have unlimited access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const maxPerDay = subscription.subscription_tier === 'free' ? 1 : 
                      subscription.subscription_tier === 'scholar' ? 10 : 100;

    const today = new Date().toISOString().split('T')[0];
    
    const { count, error } = await this.supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (error) {
      // console.error('Error counting quizzes:', error);
      return { allowed: true };
    }

    const currentCount = count || 0;
    if (currentCount >= maxPerDay) {
      return {
        allowed: false,
        message: `Daily quiz limit reached (${maxPerDay}/day). You have generated ${currentCount} quizzes today.`,
        currentUsage: currentCount,
        limit: maxPerDay
      };
    }

    return { allowed: true };
  }

  /**
   * Get tier level for comparison (0 = free, 1 = scholar, 2 = genius)
   */
  getTierLevel(tier: 'free' | 'scholar' | 'genius'): number {
    const levels: Record<string, number> = {
      'free': 0,
      'scholar': 1,
      'genius': 2
    };
    return levels[tier] || 0;
  }

  /**
   * Check if user tier meets minimum requirement
   */
  async hasMinimumTier(userId: string, requiredTier: 'free' | 'scholar' | 'genius'): Promise<ValidationResult> {
    // Admins have full access
    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) {
      return { allowed: true };
    }

    const subscription = await this.getUserSubscription(userId);
    const userLevel = this.getTierLevel(subscription.subscription_tier);
    const requiredLevel = this.getTierLevel(requiredTier);

    if (userLevel < requiredLevel) {
      const tierNames: Record<string, string> = {
        'free': 'Free',
        'scholar': 'Scholar',
        'genius': 'Genius'
      };
      return {
        allowed: false,
        message: `This feature requires ${tierNames[requiredTier]} plan or higher. Your current plan: ${tierNames[subscription.subscription_tier]}`
      };
    }

    return { allowed: true };
  }
}

/**
 * Helper function to create validator with environment variables
 */
export function createSubscriptionValidator(): SubscriptionValidator {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return new SubscriptionValidator(supabaseUrl, supabaseServiceKey);
}

/**
 * Create error response with proper status and message
 */
export function createErrorResponse(message: string, status: number = 403) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  });
}

/**
 * Extract user ID from authorization header
 */
export async function extractUserIdFromAuth(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    // console.error('Error extracting user ID:', error);
    return null;
  }
}

