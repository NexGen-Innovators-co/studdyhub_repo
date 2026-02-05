
import React, { useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { RefreshCw, Eye, Trash2, Folder, Loader2, MoreHorizontal, FileText, ArrowRightLeft } from 'lucide-react';
import { Document } from '../../types/Document';
import { DocumentFolder } from '../../types/Folder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { 
  formatFileSize, 
  formatDate, 
  getFileCategory, 
  getCategoryIcon, 
  getCategoryColor, 
  getStatusColor, 
  getStatusIcon 
} from './documentUtils';

interface DocumentCardItemProps {
    doc: Document;
    viewMode: 'grid' | 'list';
    isSelected: boolean;
    isProcessing: boolean;
    isUploading: boolean;
    showSelection: boolean;
    onToggleSelect: (id: string) => void;
    onPreview: (doc: Document) => void;
    onDelete: (id: string, url: string) => void;
    onMove: (doc: Document) => void;
    onRetry: (doc: Document) => void;
    onSelectFolder: (folderId: string) => void;
    folders: DocumentFolder[];
}
  
export const DocumentCardItem = React.memo(React.forwardRef<HTMLDivElement, DocumentCardItemProps>(({
    doc, viewMode, isSelected, isProcessing, isUploading, showSelection,
    onToggleSelect, onPreview, onDelete, onMove, onRetry, onSelectFolder,
    folders
}, ref) => {
    
    // Helper to stop propagation for button clicks
    const handleAction = useCallback((e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    }, []);

    const category = getFileCategory(doc.file_type);
    const Icon = getCategoryIcon(category);
    
    // We remove the heavy slide-in animation on every item
    const cardClassName = `group overflow-hidden hover:shadow-xl transition-all duration-200 border-blue-200/50 dark:border-blue-900/50 flex flex-col relative rounded-2xl cursor-pointer bg-white dark:bg-slate-800 ${viewMode === 'list' ? 'flex' : 'h-full'}`;

    return (
        <Card
          ref={ref}
          className={cardClassName}
          onClick={() => onPreview(doc)}
        >
          <CardContent className="p-0 h-full flex flex-col">
            {viewMode === 'grid' ? (
              <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden flex-shrink-0">
                {/* Document Preview or Icon */}
                <div
                  className="absolute inset-0 bg-slate-200 dark:bg-slate-800 text-slate-900 flex items-center justify-center"
                  style={{
                    backgroundImage: category === 'image' && doc.file_url ? `url(${doc.file_url})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {category !== 'image' && (
                    <div className="w-full h-full flex items-center justify-center">
                       <Icon className="h-16 w-16 text-blue-600 dark:text-blue-300 opacity-70" />
                    </div>
                  )}
                </div>
                
                {/* Gradient Overlay - Simplified */}
                <div className="absolute border inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent pointer-events-none" />

                {/* Selection checkbox */}
                {showSelection && (
                  <div 
                    onClick={(e) => handleAction(e, () => onToggleSelect(doc.id))}
                    className="absolute top-2 left-2 bg-white dark:bg-slate-800 rounded-md p-1.5 shadow-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 z-10"
                  >
                    <Checkbox 
                      checked={isSelected}
                      className="h-5 w-5"
                    />
                  </div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                    </div>
                  </div>
                )}

                {/* Bottom Info */}
                <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-3 sm:p-4">
                  <div className="space-y-1.5 mb-2">
                    <h3 className="text-white dark:text-slate-100 font-bold text-sm sm:text-base line-clamp-2 leading-tight">
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <Folder className="h-4 w-4 text-white/80" />
                      <span className="text-white/90 dark:text-slate-200 text-xs truncate">
                        {folders.find(f => f.id === doc.folder_ids?.[0])?.name || 'No Folder'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions Row */}
                  <div className={`flex gap-1.5 ${isProcessing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}> 
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white border-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => onPreview(doc)}>
                          <Eye className="mr-2 h-4 w-4" /> Preview
                        </DropdownMenuItem>
                        {doc.processing_status === 'failed' && (
                           <DropdownMenuItem onClick={() => onRetry(doc)}>
                             <RefreshCw className="mr-2 h-4 w-4" /> Retry Analysis
                           </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onMove(doc)}>
                          <Folder className="mr-2 h-4 w-4" /> Move to Folder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(doc.id, doc.file_url)}
                            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ) : (
              // List View
              <div className="flex items-center p-4 gap-4">
                 <div className="flex-shrink-0 w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                    {category === 'image' && doc.file_url ? (
                      <img src={doc.file_url} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Icon className="h-6 w-6 text-slate-400" />
                    )}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-slate-800 dark:text-slate-200">{doc.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex gap-3">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>{formatDate(doc.created_at)}</span>
                    </p>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {/* List Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4 text-slate-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => onPreview(doc)}>
                          <Eye className="mr-2 h-4 w-4" /> Preview
                        </DropdownMenuItem>
                        {doc.processing_status === 'failed' && (
                           <DropdownMenuItem onClick={() => onRetry(doc)}>
                             <RefreshCw className="mr-2 h-4 w-4" /> Retry Analysis
                           </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onMove(doc)}>
                          <Folder className="mr-2 h-4 w-4" /> Move to Folder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(doc.id, doc.file_url)}
                            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
    );
}));
