/**
 * Schedule Service — Schedule items via the API Gateway.
 */

import { apiClient } from './apiClient';

export interface ScheduleItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  color: string;
  recurrence: string | null;
  created_at: string;
}

export const scheduleService = {
  async list(): Promise<ScheduleItem[]> {
    return apiClient.get<ScheduleItem[]>('schedule');
  },

  async create(item: Partial<ScheduleItem> & { id?: string }): Promise<ScheduleItem> {
    return apiClient.post<ScheduleItem>('schedule', item);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    return apiClient.delete(`schedule/${id}`);
  },
};
