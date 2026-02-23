import React, { useState, useEffect } from 'react';
import { Search, Book, Loader2, School, Globe, Library, Check, ChevronsUpDown, RefreshCw, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCourseLibrary, Course } from '@/hooks/useCourseLibrary';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CourseFilterBar, type CourseFilterState } from './CourseFilterBar';
import { useEducationContext } from '@/hooks/useEducationContext';

interface CourseListProps {
  onSelectCourse: (course: Course) => void;
}

export const CourseList: React.FC<CourseListProps> = ({ onSelectCourse }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams();
  const { useCourses } = useCourseLibrary();
  const { educationContext } = useEducationContext();
  
  const activeTab = (tab && ['for-you', 'my-school', 'global', 'all'].includes(tab)) ? tab : (educationContext ? 'for-you' : 'my-school');
  
  const [educationFilters, setEducationFilters] = useState<CourseFilterState>({
    curriculumId: null,
    educationLevelId: null,
    countryId: null,
    subjectIds: [],
  });

  // Auto-apply education context as default filters when available
  useEffect(() => {
    if (educationContext && activeTab === 'for-you') {
      setEducationFilters({
        curriculumId: educationContext.curriculum?.id ?? null,
        educationLevelId: educationContext.educationLevel?.id ?? null,
        countryId: educationContext.country?.id ?? null,
        subjectIds: educationContext.subjects.map(s => s.id),
      });
    }
  }, [educationContext, activeTab]);
  
  const [userSchool, setUserSchool] = useState<string | null>(null);
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [tempSchoolName, setTempSchoolName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableSchools, setAvailableSchools] = useState<string[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);

  const handleTabChange = (value: string) => {
    navigate(`/library/${value}`);
  };

  // Sync with Header tabs
  useEffect(() => {
    const handleHeaderTabChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.section === 'library' && detail?.tab) {
        handleTabChange(detail.tab);
      }
    };

    window.addEventListener('section-tab-change', handleHeaderTabChange as EventListener);
    return () => window.removeEventListener('section-tab-change', handleHeaderTabChange as EventListener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify Header about active tab
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('section-tab-active', {
        detail: { section: 'library', tab: activeTab }
      })
    );
  }, [activeTab]);

  // Fetch user profile to get school
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      // Fetch available schools first
      const { data: schoolData } = await supabase
        .from('courses')
        .select('school_name')
        .not('school_name', 'is', null);
      
      if (schoolData) {
        const unique = Array.from(new Set(schoolData.map(d => d.school_name).filter(Boolean) as string[]));
        setAvailableSchools(unique.sort());
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('school') // Assuming 'school' column exists now
        .eq('id', user.id)
        .single();
      
      if (data && (data as any).school) {
        setUserSchool((data as any).school);
      } else {
        // If no school set, prompt user or default to global
        setIsSchoolDialogOpen(true);
        handleTabChange('global');
      }
    };
    fetchProfile();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine filter based on active tab
  const getFilter = () => {
    if (activeTab === 'for-you') return 'for-you';
    if (activeTab === 'my-school') return userSchool;
    if (activeTab === 'global') return 'global';
    return null; // 'all'
  };

  const { data: courses, isLoading, refetch } = useCourses(
    getFilter(),
    activeTab === 'for-you' ? educationFilters : null
  );

  const handleSaveSchool = async () => {
    if (!user || !tempSchoolName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ school: tempSchoolName.trim() } as any)
        .eq('id', user.id);

      if (error) throw error;

      setUserSchool(tempSchoolName.trim());
      setIsSchoolDialogOpen(false);
      handleTabChange('my-school');
      toast.success('School updated successfully!');
    } catch (error) {
      toast.error('Failed to update school.');
    }
  };

  const filteredCourses = courses?.filter(course => 
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (course.department && course.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">Course Library</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {userSchool ? `Browsing courses for ${userSchool}` : 'Access lecture notes, past questions, and more.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => refetch()} 
             disabled={isLoading}
             title="Refresh Courses"
           >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
           </Button>
           {userSchool && (
            <Button variant="outline" size="sm" onClick={() => setIsSchoolDialogOpen(true)} className="hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-800 dark:hover:text-blue-400">
              Change School
            </Button>
           )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[520px]">
          <TabsTrigger value="for-you" disabled={!educationContext} className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-900/40 dark:data-[state=active]:text-violet-300">
            <Sparkles className="w-4 h-4 mr-2" />
            For You
          </TabsTrigger>
          <TabsTrigger value="my-school" disabled={!userSchool} className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300">
            <School className="w-4 h-4 mr-2" />
            My School
          </TabsTrigger>
          <TabsTrigger value="global" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300">
            <Globe className="w-4 h-4 mr-2" />
            Global / AI
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300">
            <Library className="w-4 h-4 mr-2" />
            Browse All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Education context filter bar for "For You" tab */}
      {activeTab === 'for-you' && (
        <CourseFilterBar
          educationContext={educationContext}
          filters={educationFilters}
          onFiltersChange={setEducationFilters}
        />
      )}

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
            {filteredCourses?.map((course) => (
              <Card 
                key={course.id} 
                className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-blue-500/50 group bg-white/90 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 rounded-xl hover:scale-[1.02]"
                onClick={() => onSelectCourse(course)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                      {course.code}
                    </Badge>
                    {course.school_name && (
                       <Badge variant="outline" className="text-[10px] truncate max-w-[100px]">
                         {course.school_name}
                       </Badge>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {course.department}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground group-hover:text-blue-500 transition-colors">
                    <Book className="w-4 h-4 mr-2" />
                    <span>View Materials</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredCourses?.length === 0 && (
              <div className="col-span-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-full flex items-center justify-center">
                  <Book className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Courses Found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">No courses found matching your search.</p>
                {activeTab === 'my-school' && (
                  <Button variant="link" className="text-blue-600" onClick={() => handleTabChange('all')}>
                    Try browsing all schools
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
        <DialogContent className="sm:max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Select Your School</DialogTitle>
            <DialogDescription>
              Select your school to see relevant courses or enter it manually if not listed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Select from list</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="justify-between"
                  >
                    {tempSchoolName
                      ? availableSchools.find((school) => school === tempSchoolName) || tempSchoolName
                      : "Select school..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search school..." />
                    <CommandList>
                      <CommandEmpty>No school found.</CommandEmpty>
                      <CommandGroup>
                        {availableSchools.map((school) => (
                          <CommandItem
                            key={school}
                            value={school}
                            onSelect={(currentValue) => {
                              setTempSchoolName(currentValue === tempSchoolName ? "" : currentValue);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                tempSchoolName === school ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {school}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex flex-col gap-2">
               <label className="text-sm font-medium">Or enter manually</label>
               <Input
                id="school"
                placeholder="e.g. University of Ghana"
                value={tempSchoolName}
                onChange={(e) => setTempSchoolName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSchoolDialogOpen(false)}>Skip</Button>
            <Button onClick={handleSaveSchool}>Save School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
