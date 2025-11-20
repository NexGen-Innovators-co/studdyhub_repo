import { Upload } from 'lucide-react';

interface DragOverlayProps {
  isDragging: boolean;
}

export const DragOverlay = ({ isDragging }: DragOverlayProps) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 bg-blue-500/20 dark:bg-blue-500/30 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border-2 border-dashed border-blue-500 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <Upload className="h-16 w-16 text-blue-500" />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Drop files here to attach
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Images, documents, and other files are supported
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};