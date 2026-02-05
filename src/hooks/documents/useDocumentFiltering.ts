import { useState, useMemo } from 'react';
import { Document } from '../../types/Document';
import { getFileCategory } from '../../components/documents/documentUtils';

interface UseDocumentFilteringProps {
  documents: Document[];
  searchResults: Document[] | null;
  externalSearchQuery?: string;
  onSearchChange?: (query: string) => void;
  search: (query: string) => void;
}

export const useDocumentFiltering = ({
  documents,
  searchResults,
  externalSearchQuery,
  onSearchChange,
  search
}: UseDocumentFilteringProps) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const effectiveSearch = externalSearchQuery ?? internalSearch;

  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    if (!value.trim()) {
      setHasSearched(false);
    } else {
      setHasSearched(true);
      search(value);
    }
    onSearchChange?.(value);
  };

  const documentStats = useMemo(() => {
    const stats = {
      all: documents.length,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      spreadsheet: 0,
      presentation: 0,
      archive: 0,
      code: 0,
      other: 0,
      completed: 0,
      pending: 0,
      failed: 0
    };

    documents.forEach(doc => { 
      const category = getFileCategory(doc.file_type);
      if (category in stats) {
           stats[category as keyof typeof stats]++;
      } else {
          stats.other++;
      }
      
      const status = doc.processing_status || 'pending';
      if (status in stats) {
          stats[status as keyof typeof stats]++;
      }
    });

    return stats;
  }, [documents]);

  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = (hasSearched && effectiveSearch.trim() && searchResults) 
        ? searchResults 
        : documents.filter(doc => {
            const matchesSearch = doc.title.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
            doc.content_extracted?.toLowerCase().includes(effectiveSearch.toLowerCase());

            const matchesCategory = selectedCategory === 'all' || getFileCategory(doc.file_type) === selectedCategory;
            const matchesStatus = selectedStatus === 'all' || doc.processing_status === selectedStatus;

            return matchesSearch && matchesCategory && matchesStatus;
        });

    // Sort documents
    // Create a copy to avoid mutating the original array if it comes from props/context
    const sorted = [...filtered]; 
    
    sorted.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'size':
          aValue = a.file_size;
          bValue = b.file_size;
          break;
        case 'type':
          aValue = a.file_type;
          bValue = b.file_type;
          break;
        case 'date':
        default:
          aValue = a.created_at;
          bValue = b.created_at;
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return sorted;
  }, [documents, effectiveSearch, selectedCategory, selectedStatus, sortBy, sortOrder, hasSearched, searchResults]);

  return {
    internalSearch,
    hasSearched,
    effectiveSearch,
    selectedCategory,
    setSelectedCategory,
    selectedStatus,
    setSelectedStatus,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode,
    handleSearchChange,
    documentStats,
    filteredAndSortedDocuments
  };
}
