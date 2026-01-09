import React, { useMemo } from 'react';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourseLibrary, Course } from '@/hooks/useCourseLibrary';
import { ResourceCard } from './ResourceCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({ course, onBack }) => {
  const { useCourseMaterials } = useCourseLibrary();
  const { data: materials, isLoading } = useCourseMaterials(course.id);

  const groupedMaterials = useMemo(() => {
    if (!materials) return {};
    
    return materials.reduce((acc, material) => {
      const category = material.category || 'Other Resources';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(material);
      return acc;
    }, {} as Record<string, typeof materials>);
  }, [materials]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {course.code} <span className="text-muted-foreground font-normal">|</span> {course.title}
          </h2>
          <p className="text-muted-foreground">{course.department}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-8 pb-8">
          {Object.entries(groupedMaterials).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No materials available for this course yet.</p>
            </div>
          ) : (
            Object.entries(groupedMaterials).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="h-6 w-1 bg-blue-600 rounded-full" />
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((material) => (
                    <ResourceCard key={material.id} material={material} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
