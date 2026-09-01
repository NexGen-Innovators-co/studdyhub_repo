/**
 * useOfflineSync.ts - Hook to manage offline data synchronization
 */
import { useEffect, useCallback } from 'react';
import { offlineStorage } from '../utils/offlineStorage';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';

export const useOfflineSync = (refreshData: () => void) => {
  const syncPendingChanges = useCallback(async () => {
    const pendingSync = await offlineStorage.getPendingSync();
    if (pendingSync.length === 0) return;

    // Sort by timestamp to maintain order
    const sortedSync = [...pendingSync].sort((a, b) => a.timestamp - b.timestamp);
    let syncedCount = 0;

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

        // Map database table names to API endpoint paths
        const apiPathMap: Record<string, string> = {
          social_users: 'social-users',
          social_likes: 'social-likes',
          social_bookmarks: 'social-bookmarks',
          social_shares: 'social-shares',
          podcast_listeners: 'podcast-listeners',
          notes: 'notes',
          documents: 'documents',
        };
        const apiPath = apiPathMap[tableName] || tableName;

        if (action === 'create') {
          await apiClient.post(apiPath, data);
          error = null;
        } else if (action === 'update') {
          await apiClient.patch(`${apiPath}/${data.id}`, data);
          error = null;
        } else if (action === 'delete') {
          if (tableName === 'social_likes' || tableName === 'social_bookmarks') {
            await apiClient.delete(apiPath, { post_id: data.post_id, user_id: data.user_id });
          } else if (tableName === 'podcast_listeners') {
            await apiClient.delete(apiPath, { podcast_id: data.podcast_id, user_id: data.user_id });
          } else {
            await apiClient.delete(`${apiPath}/${data.id}`);
          }
          error = null;
        }

        if (!error) {
          await offlineStorage.removePendingSync(item.id);
          syncedCount++;
        } else {
          //console.error(`Failed to sync item ${item.id}:`, error);
        }
      } catch (err) {
        //console.error(`Error syncing item ${item.id}:`, err);
      }
    }

    if (syncedCount > 0) {
      toast.success(`Synchronized ${syncedCount} offline changes`);
      refreshData();
    }
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
