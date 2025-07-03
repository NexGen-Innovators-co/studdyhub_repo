
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { TabContent } from '../components/TabContent';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { useAppOperations } from '../hooks/useAppOperations';
import { Button } from '../components/ui/button';
import { LogOut, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const {
    notes,
    recordings,
    scheduleItems,
    chatMessages,
    activeNote,
    searchQuery,
    selectedCategory,
    isSidebarOpen,
    activeTab,
    isAILoading,
    filteredNotes,
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages,
    setActiveNote,
    setSearchQuery,
    setSelectedCategory,
    setIsSidebarOpen,
    setActiveTab,
    setIsAILoading,
  } = useAppData();

  const {
    createNewNote,
    updateNote,
    deleteNote,
    addRecording,
    generateQuiz,
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    sendChatMessage,
  } = useAppOperations({
    notes,
    recordings,
    scheduleItems,
    chatMessages,
    activeNote,
    setNotes,
    setRecordings,
    setScheduleItems,
    setChatMessages,
    setActiveNote,
    setActiveTab,
    setIsAILoading,
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render main content if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-blue-50">
      <Sidebar 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        noteCount={notes.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <Header 
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewNote={createNewNote}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">Welcome, {user.email}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <TabContent
          activeTab={activeTab}
          filteredNotes={filteredNotes}
          activeNote={activeNote}
          recordings={recordings}
          scheduleItems={scheduleItems}
          chatMessages={chatMessages}
          isAILoading={isAILoading}
          onNoteSelect={setActiveNote}
          onNoteUpdate={updateNote}
          onNoteDelete={deleteNote}
          onAddRecording={addRecording}
          onGenerateQuiz={generateQuiz}
          onAddScheduleItem={addScheduleItem}
          onUpdateScheduleItem={updateScheduleItem}
          onDeleteScheduleItem={deleteScheduleItem}
          onSendMessage={sendChatMessage}
        />
      </div>
    </div>
  );
};

export default Index;
