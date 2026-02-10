import React from 'react';
import { Search, RefreshCw, List, Grid } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';

interface DocumentFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  sortBy: string;
  sortOrder: string;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  documentStats: {
    image: number;
    document: number;
    video: number;
    audio: number;
    code: number;
    archive: number;
    completed: number;
    pending: number;
    failed: number;
  };
  children?: React.ReactNode;
}

export const DocumentFilters: React.FC<DocumentFiltersProps> = React.memo(({
  searchQuery, onSearchChange, onRefresh, isRefreshing,
  selectedCategory, onCategoryChange,
  selectedStatus, onStatusChange,
  sortBy, sortOrder, onSortChange,
  viewMode, onViewModeChange,
  documentStats,
  children
}) => {
  return (
    <div className="mb-8">
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
             <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search files by name or content..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-700"
                />
              </div>

             {/* Refresh Button */}
             <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2"
                title="Refresh documents"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
               <select
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images ({documentStats.image})</option>
                  <option value="document">Documents ({documentStats.document})</option>
                  <option value="video">Videos ({documentStats.video})</option>
                  <option value="audio">Audio ({documentStats.audio})</option>
                  <option value="code">Code ({documentStats.code})</option>
                  <option value="archive">Archives ({documentStats.archive})</option>
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed ({documentStats.completed})</option>
                  <option value="pending">Pending ({documentStats.pending})</option>
                  <option value="failed">Failed ({documentStats.failed})</option>
                </select>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-');
                    onSortChange(newSortBy, newSortOrder);
                  }}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-sm"
                >
                  <option value="date-desc">Latest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="size-desc">Largest First</option>
                  <option value="size-asc">Smallest First</option>
                </select>

                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}
                    className="px-3"
                  >
                    {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                  </Button>
                  
                  {children}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
