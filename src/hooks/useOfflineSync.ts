/**
 * useOfflineSync.ts - Hook to manage offline data synchronization
 */
import { useEffect, useCallback } from 'react';
import { offlineStorage, STORES } from '../utils/offlineStorage';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

export const useOfflineSync = (refreshData: () => void) => {
  const syncPendingChanges = useCallback(async () => {
    const pendingSync = await offlineStorage.getPendingSync();
    if (pendingSync.length === 0) return;
    
    // Sort by timestamp to maintain order
    const sortedSync = [...pendingSync].sort((a, b) => a.timestamp - b.timestamp);

    for (const item of sortedSync) {
      try {
        const { action, storeName, data } = item;
        let error;

        // Map store names to table names
        const tableMap: Record<string, string> = {
          'notes': 'notes',
          'documents': 'documents',
          'folders': 'document_folders',
          'quizzes': 'quizzes',
          'recordings': 'class_recordings',
          'schedule': 'schedule_items',
          'profile': 'profiles',
          'chat_messages': 'chat_messages',
          'chat_sessions': 'chat_sessions',
          'social_posts': 'social_posts',
          'social_groups': 'social_groups',
          'social_likes': 'social_likes',
          'social_bookmarks': 'social_bookmarks',
          'podcasts': 'ai_podcasts',
          'podcast_listeners': 'podcast_listeners'
        };

        const tableName = tableMap[storeName] || storeName;

        if (action === 'create') {
          const { error: createError } = await supabase
            .from(tableName)
            .insert(data);
          error = createError;
        } else if (action === 'update') {
          const { error: updateError } = await supabase
            .from(tableName)
            .update(data)
            .eq('id', data.id);
          error = updateError;
        } else if (action === 'delete') {
          let query = supabase.from(tableName).delete();
          
          if (tableName === 'social_likes' || tableName === 'social_bookmarks') {
            query = query.eq('post_id', data.post_id).eq('user_id', data.user_id);
          } else if (tableName === 'podcast_listeners') {
            query = query.eq('podcast_id', data.podcast_id).eq('user_id', data.user_id);
          } else {
            query = query.eq('id', data.id);
          }
          
          const { error: deleteError } = await query;
          error = deleteError;
        }

        if (!error) {
          await offlineStorage.removePendingSync(item.id);
        } else {
          console.error(`Failed to sync item ${item.id}:`, error);
        }
      } catch (err) {
        console.error(`Error syncing item ${item.id}:`, err);
      }
    }

    toast.success('Offline changes synchronized');
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const handleOnline = () => {
      syncPendingChanges();
    };

    window.addEventListener('online', handleOnline);
    
    // Initial check
    if (navigator.onLine) {
      syncPendingChanges();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingChanges]);

  return { syncPendingChanges };
};
