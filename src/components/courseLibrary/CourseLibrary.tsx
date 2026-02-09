import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CourseList } from './CourseList';
import { CourseDetail } from './CourseDetail';
import { Course } from '@/hooks/useCourseLibrary';
import CourseDashboard from '@/pages/CourseDashboard';

type View = 'list' | 'detail' | 'dashboard';

export const CourseLibrary: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ tab?: string; courseId?: string }>();
  const location = useLocation();
  const [view, setView] = useState<View>('list');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // When user selects a course from the list
  const handleSelectCourse = useCallback((course: Course) => {
    setSelectedCourse(course);
    setView('detail');
    // Remove courseId from URL if present
    if (params.courseId) {
      navigate('/library', { replace: true });
    }
  }, [navigate, params.courseId]);

  // When user clicks Enroll/Continue
  const handleOpenDashboard = useCallback(() => {
    if (selectedCourse) {
      navigate(`/library/${selectedCourse.id}`);
      setView('dashboard');
    }
  }, [navigate, selectedCourse]);

  // When user clicks back from dashboard
  const handleBackToDetail = useCallback(() => {
    setView('detail');
    // Remove courseId from URL
    navigate('/library', { replace: true });
  }, [navigate]);

  // When user clicks back from detail
  const handleBackToList = useCallback(() => {
    setSelectedCourse(null);
    setView('list');
    navigate('/library', { replace: true });
  }, [navigate]);

  // On mount or URL change, sync state with URL
  useEffect(() => {
    const courseId = params.courseId;
    if (courseId) {
      // If courseId in URL, open dashboard view
      if (!selectedCourse || selectedCourse.id !== courseId) {
        // If we don't have the course object, open detail first, then dashboard after fetch
        setSelectedCourse((prev) => prev && prev.id === courseId ? prev : { id: courseId } as Course);
      }
      setView('dashboard');
    } else if (selectedCourse) {
      // If no courseId in URL but we have a selected course, show detail
      setView('detail');
    } else {
      setView('list');
    }
  }, [params.courseId]);

  return (
    <div className="h-full p-6 bg-background">
      {view === 'dashboard' && selectedCourse ? (
        <CourseDashboard
          courseId={selectedCourse.id}
          course={selectedCourse}
          onBack={handleBackToDetail}
          inline
        />
      ) : view === 'detail' && selectedCourse ? (
        <CourseDetail
          course={selectedCourse}
          onBack={handleBackToList}
          onOpenDashboard={handleOpenDashboard}
        />
      ) : (
        <CourseList onSelectCourse={handleSelectCourse} />
      )}
    </div>
  );
};
