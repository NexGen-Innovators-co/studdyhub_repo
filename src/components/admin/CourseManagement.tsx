import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, BookOpen, FileText, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GenerateCourseDialog } from './GenerateCourseDialog';
import { AIGeneratedCourse } from '@/services/aiServices';

const CourseManagement = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Queries ---
  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: materials, isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['admin-course-materials', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from('course_materials')
        .select('*, documents(title)')
        .eq('course_id', selectedCourseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseId,
  });

  // --- Mutations ---
  const createCourseMutation = useMutation({
    mutationFn: async (newCourse: any) => {
      const { error } = await supabase.from('courses').insert(newCourse);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setIsAddCourseOpen(false);
      toast.success('Course created successfully');
    },
    onError: (error) => toast.error(`Error creating course: ${error.message}`),
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (newMaterial: any) => {
      const { error } = await supabase.from('course_materials').insert(newMaterial);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-materials', selectedCourseId] });
      setIsAddMaterialOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Material added successfully');
    },
    onError: (error) => toast.error(`Error adding material: ${error.message}`),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      if (selectedCourseId) setSelectedCourseId(null);
      toast.success('Course deleted');
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-materials', selectedCourseId] });
      toast.success('Material deleted');
    },
  });

  // --- Helpers ---
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleAIGeneratedCourse = async (courseData: AIGeneratedCourse) => {
    try {
      // 1. Create Course
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          title: courseData.title,
          code: courseData.code,
          description: courseData.description,
          // Defaults for required fields
          department: 'General',
          level: 1, 
          semester: 1,
          school_name: null 
        })
        .select()
        .single();
      
      if (courseError) throw courseError;
      if (!newCourse) throw new Error("Failed to create course");

      // 2. Create Modules
      if (courseData.modules && courseData.modules.length > 0) {
        const materialsToInsert = courseData.modules.map(mod => ({
          course_id: newCourse.id,
          title: mod.title,
          description: mod.description,
          category: mod.category || 'Lecture',
          document_id: null
        }));

        const { error: materialError } = await supabase
          .from('course_materials')
          .insert(materialsToInsert);

        if (materialError) throw materialError;
      }

      // Success
      toast.success(`Course "${newCourse.title}" created with ${courseData.modules.length} modules.`);
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });

    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to save AI course: ${error.message}`);
    }
  };

  // --- Forms ---
  const handleCreateCourse = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const isGlobal = formData.get('is_global') === 'on';
    const schoolName = isGlobal ? null : formData.get('school_name');

    createCourseMutation.mutate({
      title: formData.get('title'),
      code: formData.get('code'),
      department: formData.get('department'),
      level: Number(formData.get('level')),
      semester: Number(formData.get('semester')),
      description: formData.get('description'),
      school_name: schoolName,
    });
  };

  const handleCreateMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCourseId || !user?.id) return;
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const category = formData.get('category')?.toString() || null;
    const description = formData.get('description')?.toString() || null;
    let documentId = formData.get('document_id') as string;

    // Validate document ID if manually entered
    if (documentId && documentId.trim() !== '') {
      // Simple UUID regex check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(documentId)) {
        toast.error('Invalid Document ID format. It must be a valid UUID.');
        return;
      }
    } else {
      // Ensure it's null if empty
      documentId = null as any;
    }

    // If a file is selected, upload it first
    if (selectedFile) {
      setIsUploading(true);
      setUploadProgress(10);
      
      try {
        const functionUrl = 'https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/document-processor';
        const base64Data = await getBase64(selectedFile);
        setUploadProgress(30);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('No valid authentication token found');

        const payload = {
          userId: user.id,
          files: [{
            name: selectedFile.name,
            mimeType: selectedFile.type,
            data: base64Data,
            size: selectedFile.size
          }]
        };

        setUploadProgress(60);

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload),
        });

        setUploadProgress(90);

        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(`Processing failed: ${errorBody.error || 'Unknown error'}`);
        }

        const result = await response.json();
        setUploadProgress(100);

        if (result.documents && result.documents.length > 0) {
          documentId = result.documents[0].id;
          toast.success(`Document "${selectedFile.name}" uploaded and processed.`);
        } else {
          throw new Error('File processed but no document ID returned.');
        }
      } catch (error: any) {
        toast.error(`Failed to upload file: ${error.message}`);
        setIsUploading(false);
        setUploadProgress(0);
        return; // Stop submission if upload fails
      } finally {
        setIsUploading(false);
      }
    }

    // Create the material record
    const materialData = {
      course_id: selectedCourseId,
      title: title,
      category: category,
      description: description,
      document_id: documentId || null, 
    };

    // Ensure document_id is not an empty string
    if (materialData.document_id === '') {
      materialData.document_id = null;
    }

    createMaterialMutation.mutate(materialData);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Course Management</h1>
        <div className="flex items-center gap-2">
          <GenerateCourseDialog onCourseGenerated={handleAIGeneratedCourse} />
          <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Course</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Course</DialogTitle>
              <DialogDescription>
                Enter the details for the new course below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Course Code</Label>
                <Input id="code" name="code" placeholder="e.g. CS101" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Course Title</Label>
                <Input id="title" name="title" placeholder="Introduction to Computer Science" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" placeholder="Computer Science" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="level">Level</Label>
                  <Input id="level" name="level" type="number" placeholder="100" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Input id="semester" name="semester" type="number" placeholder="1" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              
              <div className="grid gap-2 p-4 border rounded-md bg-muted/20">
                <div className="flex items-center space-x-2 mb-2">
                  <input type="checkbox" id="is_global" name="is_global" className="h-4 w-4" onChange={(e) => {
                    const schoolInput = document.getElementById('school_name') as HTMLInputElement;
                    if (schoolInput) schoolInput.disabled = e.target.checked;
                  }} />
                  <Label htmlFor="is_global" className="font-medium">Global Course (Available to All)</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school_name">School / University Name</Label>
                  <Input id="school_name" name="school_name" placeholder="e.g. University of Ghana" />
                  <p className="text-xs text-muted-foreground">Leave empty or check "Global" for general courses.</p>
                </div>
              </div>

              <Button type="submit" disabled={createCourseMutation.isPending}>
                {createCourseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Course
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course List */}
        <Card className="md:col-span-1 h-[calc(100vh-200px)] overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>Courses</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            {isLoadingCourses ? (
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            ) : (
              courses?.map((course) => (
                <div
                  key={course.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex justify-between items-center ${
                    selectedCourseId === course.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <div>
                    <div className="font-medium">{course.code}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">{course.title}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this course?')) deleteCourseMutation.mutate(course.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Materials List */}
        <Card className="md:col-span-2 h-[calc(100vh-200px)] overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {selectedCourseId 
                ? `Materials for ${courses?.find(c => c.id === selectedCourseId)?.code}` 
                : 'Select a course to view materials'}
            </CardTitle>
            {selectedCourseId && (
              <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Material</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Material</DialogTitle>
                    <DialogDescription>
                      Add a new material to this course. You can upload a file or link an existing document.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateMaterial} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mat-title">Title</Label>
                      <Input id="mat-title" name="title" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" defaultValue="lecture_notes">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lecture_notes">Lecture Notes</SelectItem>
                          <SelectItem value="past_questions">Past Questions</SelectItem>
                          <SelectItem value="slides">Slides</SelectItem>
                          <SelectItem value="textbook">Textbook</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2 border p-4 rounded-md bg-muted/20">
                      <Label>Document Source</Label>
                      <div className="space-y-4 mt-2">
                        <div className="grid gap-2">
                          <Label htmlFor="file-upload" className="text-xs text-muted-foreground">Option 1: Upload New File</Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              id="file-upload" 
                              type="file" 
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              className="cursor-pointer"
                            />
                          </div>
                          {selectedFile && (
                            <p className="text-xs text-green-600 flex items-center">
                              <UploadCloud className="h-3 w-3 mr-1" /> 
                              Ready to upload: {selectedFile.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or</span>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="document_id" className="text-xs text-muted-foreground">Option 2: Paste Existing Document ID</Label>
                          <Input 
                            id="document_id" 
                            name="document_id" 
                            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" 
                            disabled={!!selectedFile}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="mat-desc">Description</Label>
                      <Input id="mat-desc" name="description" />
                    </div>
                    
                    <Button type="submit" disabled={createMaterialMutation.isPending || isUploading} className="w-full">
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading & Processing ({Math.round(uploadProgress)}%)...
                        </>
                      ) : createMaterialMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Material...
                        </>
                      ) : (
                        'Add Material'
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {!selectedCourseId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a course from the list to manage its materials</p>
              </div>
            ) : isLoadingMaterials ? (
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            ) : materials?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No materials found for this course.</div>
            ) : (
              <div className="space-y-2">
                {materials?.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{material.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {material.category} • {material.documents?.title || 'No linked document'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/90"
                      onClick={() => {
                        if (confirm('Delete this material?')) deleteMaterialMutation.mutate(material.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CourseManagement;
