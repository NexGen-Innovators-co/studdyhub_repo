import React, { useState } from 'react';
import { CourseList } from './CourseList';
import { CourseDetail } from './CourseDetail';
import { Course } from '@/hooks/useCourseLibrary';

export const CourseLibrary: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  return (
    <div className="h-full p-6 bg-background">
      {selectedCourse ? (
        <CourseDetail 
          course={selectedCourse} 
          onBack={() => setSelectedCourse(null)} 
        />
      ) : (
        <CourseList onSelectCourse={setSelectedCourse} />
      )}
    </div>
  );
};
