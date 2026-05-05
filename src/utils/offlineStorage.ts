/**
 * offlineStorage.ts - IndexedDB wrapper for persistent offline storage
 */

const DB_NAME = 'studdyhub_offline_db';
const DB_VERSION = 2;

export const STORES = {
  NOTES: 'notes',
  DOCUMENTS: 'documents',
  FOLDERS: 'folders',
  QUIZZES: 'quizzes',
  RECORDINGS: 'recordings',
  SCHEDULE: 'schedule',
  PROFILE: 'profile',
  CHAT_MESSAGES: 'chat_messages',
  CHAT_SESSIONS: 'chat_sessions',
  SOCIAL_POSTS: 'social_posts',
  SOCIAL_GROUPS: 'social_groups',
  PODCASTS: 'podcasts',
  PENDING_SYNC: 'pending_sync' // For offline edits
};

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        //console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async save<T>(storeName: string, data: T | T[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveAll<T>(storeName: string, data: T[]): Promise<void> {
    return this.save(storeName, data);
  }

  async delete(storeName: string, id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all object stores in the DB (useful on user sign-out)
  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        // console.log('[OfflineStorage] clearAll: starting to clear all stores');
        const tx = this.db!.transaction(Object.values(STORES), 'readwrite');
        for (const storeName of Object.values(STORES)) {
          try {
            const store = tx.objectStore(storeName);
            store.clear();
            // console.log('[OfflineStorage] clearAll: cleared store', storeName);
          } catch (e) {
            // ignore per-store failures
            // console.warn('[OfflineStorage] clearAll: failed to clear store', storeName, e);
          }
        }
        tx.oncomplete = () => {
          // console.log('[OfflineStorage] clearAll: all stores cleared (transaction complete)');
          resolve();
        };
        tx.onerror = () => {
          // console.warn('[OfflineStorage] clearAll: transaction error while clearing stores');
          resolve(); // resolve even if some stores error to avoid blocking sign-out
        };
      } catch (err) {
        // If transaction creation failed (e.g., DB closed), try deleting the DB entirely
        try {
          // console.warn('[OfflineStorage] clearAll: transaction creation failed, attempting to delete database', err);
          const deleteReq = indexedDB.deleteDatabase(DB_NAME);
          deleteReq.onsuccess = () => {
            // console.log('[OfflineStorage] clearAll: database deleted successfully');
            resolve();
          };
          deleteReq.onerror = () => {
            // console.warn('[OfflineStorage] clearAll: deleteDatabase failed');
            resolve();
          };
        } catch (e) {
          // give up but resolve so sign-out can proceed
          // console.warn('[OfflineStorage] clearAll fallback failed', e);
          resolve();
        }
      }
    });
  }

  // Sync related methods
  async addPendingSync(action: string, storeName: string, data: any): Promise<void> {
    const syncItem = {
      id: crypto.randomUUID(),
      action, // 'create', 'update', 'delete'
      storeName,
      data,
      timestamp: Date.now()
    };
    await this.save(STORES.PENDING_SYNC, syncItem);
  }

  async getPendingSync(): Promise<any[]> {
    return this.getAll(STORES.PENDING_SYNC);
  }

  async removePendingSync(id: string): Promise<void> {
    await this.delete(STORES.PENDING_SYNC, id);
  }
}

export const offlineStorage = new OfflineStorage();

