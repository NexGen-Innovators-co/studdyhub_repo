// components/Schedule.tsx — Orchestrator (imports extracted sub-components)
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Clock, Loader2, RefreshCw, Sparkles, History, Lightbulb } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ScheduleItem } from '../../types/Class';
import { toast } from 'sonner';
import { useAppContext } from '../../hooks/useAppContext';
import { AppShell } from '../layout/AppShell';
import { StickyRail } from '../layout/StickyRail';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '../../services/globalSearchService';
import { supabase } from '../../integrations/supabase/client';
import { HeroHeader } from '../layout/HeroHeader';
import { QuickActionsCard } from '../layout/QuickActionsCard';
import { StatsCard } from '../layout/StatsCard';
import { SubscriptionGuard } from '../subscription/SubscriptionGuard';
import { format } from 'date-fns';

// Extracted sub-components & hooks
import { ScheduleForm } from './ScheduleForm';
import { CalendarView } from './CalendarView';
import { EventListView } from './EventListView';
import { useScheduleCalendar } from './useScheduleCalendar';

interface ScheduleProps {
  scheduleItems: ScheduleItem[];
  onAddItem: (item: ScheduleItem) => void;
  onUpdateItem: (item: ScheduleItem) => void;
  onDeleteItem: (id: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const Schedule: React.FC<ScheduleProps> = ({
  scheduleItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isLoading = false,
  onRefresh
}) => {
  const { refreshData, dataLoading } = useAppContext();
  const handleRefresh = onRefresh || (() => refreshData('scheduleItems'));
  const isRefreshing = isLoading || dataLoading.scheduleItems;

  // --- UI state ---
  const [activeTab, setActiveTab] = useState<'calendar' | 'upcoming' | 'today' | 'past'>('calendar');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [initialFormDate, setInitialFormDate] = useState<string | undefined>();
  const [scheduleUserId, setScheduleUserId] = useState<string | null>(null);

  // --- Global search ---
  const { search, results: searchResults, isSearching: isSearchingSchedule } = useGlobalSearch(
    SEARCH_CONFIGS.schedule,
    scheduleUserId,
    { debounceMs: 500 }
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setScheduleUserId(user?.id || null);
    };
    getUser();
  }, []);

  // --- Calendar hook (replaces inlined calendar logic) ---
  const {
    currentMonth,
    selectedDate,
    setSelectedDate,
    calendarDays,
    handlePrevMonth,
    handleNextMonth,
    handleToday,
    getEventsForDay,
    upcomingItems,
    todayItems,
    pastItems
  } = useScheduleCalendar(scheduleItems);

  // --- Tab sync with global header ---
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('section-tab-active', {
      detail: { section: 'schedule', tab: activeTab }
    }));
  }, [activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === 'schedule' && detail?.tab) {
        setActiveTab(detail.tab as 'calendar' | 'upcoming' | 'today' | 'past');
      }
    };
    window.addEventListener('section-tab-change', handler as EventListener);
    return () => window.removeEventListener('section-tab-change', handler as EventListener);
  }, []);

  // --- Form handlers ---
  const handleFormSubmit = useCallback(async (item: ScheduleItem) => {
    if (editingItem) {
      await onUpdateItem(item);
    } else {
      await onAddItem(item);
    }
  }, [editingItem, onAddItem, onUpdateItem]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingItem(null);
    setInitialFormDate(undefined);
  }, []);

  const handleShowForm = useCallback((date?: string) => {
    setInitialFormDate(date);
    setEditingItem(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((item: ScheduleItem) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        await onDeleteItem(id);
        toast.success('Schedule item deleted');
      } catch (error) {
        toast.error('Failed to delete schedule item');
      }
    }
  }, [onDeleteItem]);

  // --- Derived data ---
  const getItemsForCurrentTab = () => {
    switch (activeTab) {
      case 'today': return todayItems;
      case 'past': return pastItems;
      default: return upcomingItems;
    }
  };

  const currentItems = getItemsForCurrentTab();

  // --- Layout rails ---
  const leftRail = (
    <StickyRail>
      <QuickActionsCard
        title="Quick Actions"
        actions={[
          {
            label: "Add Schedule Item",
            icon: <Plus className="h-4 w-4 text-blue-600" />,
            onClick: () => handleShowForm(),
          },
          {
            label: isRefreshing ? "Refreshing..." : "Refresh",
            icon: <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />,
            onClick: () => handleRefresh?.(),
          }
        ]}
      />
      <StatsCard
        title="Schedule Stats"
        items={[
          { label: "Upcoming", value: upcomingItems.length, icon: <CalendarIcon className="h-4 w-4 text-blue-500" /> },
          { label: "Today", value: todayItems.length, icon: <Clock className="h-4 w-4 text-green-500" /> },
          { label: "Past", value: pastItems.length, icon: <History className="h-4 w-4 text-slate-500" /> },
        ]}
      />
    </StickyRail>
  );

  const rightRail = (
    <StickyRail>
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Add start/end times to avoid overlaps</li>
          <li>• Use types to color-code events</li>
          <li>• Refresh to sync latest changes</li>
          <li>• Keep descriptions short and clear</li>
        </ul>
      </Card>
    </StickyRail>
  );

  return (
    <AppShell left={leftRail} right={rightRail}>
      <div className="px-3 lg:px-0">
        <HeroHeader
          title="Schedule & Timetable"
          subtitle={`${currentItems.length} ${activeTab} ${currentItems.length === 1 ? 'event' : 'events'}`}
          icon={<Sparkles className="h-7 w-7 text-blue-300" />}
          gradient="from-blue-600 to-indigo-600"
          actions={
            <div className="flex gap-2">
              <SubscriptionGuard
                feature="Schedule Items"
                limitFeature="maxScheduleItems"
                currentCount={scheduleItems.length}
              >
                <Button
                  onClick={() => handleShowForm()}
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </SubscriptionGuard>
            </div>
          }
        />

        <div className="space-y-6 w-full">
          {/* ---------- Form ---------- */}
          {showForm && (
            <ScheduleForm
              editingItem={editingItem}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              scheduleCount={scheduleItems.length}
              initialDate={initialFormDate || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined)}
            />
          )}

          {/* ---------- Loading ---------- */}
          {isLoading && scheduleItems.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
                  <p className="text-slate-600 dark:text-gray-300">Loading schedule...</p>
                </div>
              </CardContent>
            </Card>
          ) : activeTab === 'calendar' ? (
            /* ---------- Calendar View ---------- */
            <CalendarView
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              calendarDays={calendarDays}
              scheduleItems={scheduleItems}
              onSelectDate={setSelectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
              getEventsForDay={getEventsForDay}
              onShowForm={handleShowForm}
              onEdit={handleEdit}
              onDelete={handleDelete}
              scheduleCount={scheduleItems.length}
            />
          ) : (
            /* ---------- List Views (upcoming / today / past) ---------- */
            <EventListView
              items={currentItems}
              activeTab={activeTab as 'upcoming' | 'today' | 'past'}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShowForm={() => handleShowForm()}
              scheduleCount={scheduleItems.length}
            />
          )}
        </div>
      </div>

      {/* Floating Action Buttons */}
      {handleRefresh && (
        <div className="fixed bottom-16 right-2 lg:bottom-4 lg:right-4 flex flex-col gap-3 z-50">
          {(window as any).__toggleTips && (
            <button
              onClick={() => (window as any).__toggleTips?.()}
              className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-shadow duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
                animation: 'glow 2s ease-in-out infinite'
              }}
              title="Quick Tips"
            >
              <Lightbulb className="w-6 h-6 fill-current" />
            </button>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:shadow-xl transition-shadow duration-300 border border-slate-100 dark:border-slate-800"
          >
            <RefreshCw className={`h-5 w-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}
    </AppShell>
  );
};