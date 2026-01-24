import React from 'react';
import { FileText, MessageSquare, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CourseMaterial, Course } from '@/hooks/useCourseLibrary';
import { useNavigate } from 'react-router-dom';

interface ResourceCardProps {
  material: CourseMaterial;
  course?: Course;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ material, course }) => {
  const navigate = useNavigate();

  const handleAskAI = () => {
    if (material.document_id) {
      // Navigate to chat tab with document ID and optional course context
      const params = new URLSearchParams();
      params.set('documentId', material.document_id);
      if (course?.id) params.set('courseId', course.id);
      if (course?.title) params.set('courseTitle', course.title);
      if (course?.code) params.set('courseCode', course.code);
      navigate(`/chat?${params.toString()}`);
    }
  };

  const handleViewDocument = () => {
    if (material.document_id) {
      navigate(`/documents?preview=${material.document_id}`);
    }
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-medium line-clamp-2" title={material.title}>
            {material.title}
          </CardTitle>
          <Badge variant="outline" className="shrink-0">
            {material.category || 'Resource'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {material.description || 'No description available.'}
        </p>
      </CardContent>
      <CardFooter className="pt-2 flex gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleAskAI}
          disabled={!material.document_id}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Ask AI
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
          onClick={handleViewDocument}
          disabled={!material.document_id}
        >
          <Eye className="w-4 h-4 mr-2" />
          View
        </Button>
      </CardFooter>
    </Card>
  );
};
