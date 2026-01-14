import React, { useState, useEffect } from 'react';
import { Search, Book, Loader2, School, Globe, Library, Check, ChevronsUpDown, RefreshCw } from 'lucide-react';
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

interface CourseListProps {
  onSelectCourse: (course: Course) => void;
}

export const CourseList: React.FC<CourseListProps> = ({ onSelectCourse }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams();
  const { useCourses } = useCourseLibrary();
  
  const activeTab = (tab && ['my-school', 'global', 'all'].includes(tab)) ? tab : 'my-school';
  
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
    if (activeTab === 'my-school') return userSchool;
    if (activeTab === 'global') return 'global';
    return null; // 'all'
  };

  const { data: courses, isLoading, refetch } = useCourses(getFilter());

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
          <h2 className="text-2xl font-bold">Course Library</h2>
          <p className="text-muted-foreground">
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
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
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
                className="cursor-pointer hover:shadow-md transition-all hover:border-blue-500/50 group"
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
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p>No courses found matching your search.</p>
                {activeTab === 'my-school' && (
                  <Button variant="link" onClick={() => handleTabChange('all')}>
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
