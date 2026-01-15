// src/pages/UserGuide.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { 
    Book, Lightbulb, Zap, FileText, Mic, LayoutDashboard, Calendar, 
    Code, Users, TrendingUp, ChevronRight, ScrollText, Settings, 
    HelpCircle, MessageSquare, Plug, Radio, Library, BrainCircuit,
    CreditCard, Share2
} from 'lucide-react';

const UserGuidePage: React.FC = () => {
    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="User Guide"
                    subtitle="Complete Documentation"
                    description="Everything you need to master StuddyHub AI and enhance your learning experience."
                />

                <div className="mb-12 space-y-12">
                    {/* Getting Started Section */}
                    <section id="getting-started" className="scroll-mt-20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Book className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Getting Started</h2>
                        </div>
                        <Card>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">1. Account Setup</h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Sign up using your email or Google account. Once logged in, you'll be directed to the dashboard where you can customize your learning profile and preferences.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">2. Dashboard Overview</h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Your dashboard is the central hub. It displays your recent notes, upcoming tasks, and learning statistics. Use the sidebar to navigate between Notes, Chat, Documents, and Settings.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </section>

                    {/* Study Tools Section */}
                    <section id="study-tools" className="scroll-mt-20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Study Tools</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <ScrollText className="h-6 w-6 text-blue-500" />
                                    <h3 className="text-xl font-bold">Smart Notes</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    The rich text editor features AI-powered auto-completion.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Type "/" for command menu</li>
                                    <li>Ask AI for expansions</li>
                                    <li>Create flashcards from notes</li>
                                </ul>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Mic className="h-6 w-6 text-red-500" />
                                    <h3 className="text-xl font-bold">Class Recordings</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Record and transcribe lectures automatically.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>High-quality audio recording</li>
                                    <li>Real-time transcription</li>
                                    <li>Generate quizzes from audio</li>
                                </ul>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <BrainCircuit className="h-6 w-6 text-purple-500" />
                                    <h3 className="text-xl font-bold">Quizzes</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Test your knowledge with AI-generated quizzes.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Generate from documents</li>
                                    <li>Track progress with stats</li>
                                    <li>earn badges for achievements</li>
                                </ul>
                            </Card>
                            
                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <FileText className="h-6 w-6 text-orange-500" />
                                    <h3 className="text-xl font-bold">Documents</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Manage and analyze your study materials.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Upload PDF, Word, Text</li>
                                    <li>Organize with folders</li>
                                    <li>Extract insights instantly</li>
                                </ul>
                            </Card>

                             <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Library className="h-6 w-6 text-teal-500" />
                                    <h3 className="text-xl font-bold">Course Library</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Access organized course resources.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>View subject materials</li>
                                    <li>Track course progress</li>
                                    <li>Access shared resources</li>
                                </ul>
                            </Card>
                        </div>
                    </section>
                    
                    {/* AI & Innovation */}
                    <section id="ai-innovation" className="scroll-mt-20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Capabilities</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <MessageSquare className="h-6 w-6 text-indigo-500" />
                                    <h3 className="text-xl font-bold">AI Chat Assistant</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Your 24/7 study companion answering questions from context.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Chat with your documents</li>
                                    <li>Context-aware responses</li>
                                    <li>Step-by-step problem solving</li>
                                </ul>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Radio className="h-6 w-6 text-pink-500" />
                                    <h3 className="text-xl font-bold">Podcast Generator</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Convert your study materials into audio lessons.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Turn notes into podcasts</li>
                                    <li>Listen while on the go</li>
                                    <li>Host live audio sessions</li>
                                </ul>
                            </Card>
                        </div>
                    </section>

                    {/* Community & Organization */}
                    <section id="community" className="scroll-mt-20">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Social & Organization</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Share2 className="h-6 w-6 text-blue-500" />
                                    <h3 className="text-xl font-bold">Social Feed</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Connect with peers and share knowledge.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Post updates and questions</li>
                                    <li>Join study groups</li>
                                    <li>Direct messaging</li>
                                </ul>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <Calendar className="h-6 w-6 text-orange-500" />
                                    <h3 className="text-xl font-bold">Schedule</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Manage your academic life effectively.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Calendar integration</li>
                                    <li>Study reminders</li>
                                    <li>Event management</li>
                                </ul>
                            </Card>

                             <Card>
                                <div className="flex items-center gap-3 mb-4">
                                    <CreditCard className="h-6 w-6 text-yellow-500" />
                                    <h3 className="text-xl font-bold">Subscription</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                                    Unlock premium features and limits.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                                    <li>Manage your plan</li>
                                    <li>View usage limits</li>
                                    <li>Access pro tools</li>
                                </ul>
                            </Card>
                        </div>
                    </section>
                </div>

                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Tips</h2>
                            <p className="text-gray-600 dark:text-gray-400">
                                Essential tips to help you get started quickly with StuddyHub AI
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Set Your Learning Style</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Go to settings and select your preferred learning style for personalized AI responses.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Use Voice Commands</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Try voice input for faster note-taking and hands-free operation during lectures.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Leverage AI Summaries</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Upload documents and let AI generate concise summaries to save study time.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Sync Across Devices</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Enable cloud sync to access your notes and recordings from any device.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-center">
                    <Card className="w-full max-w-2xl text-center">
                        <div className="flex flex-col items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Need More Help?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            Can't find what you're looking for within the guide? Our support team is here to help you navigate StuddyHub.
                        </p>
                        <Link to="/contact">
                            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg hover:shadow-blue-500/20 transition-all">
                                Contact Support
                            </button>
                        </Link>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default UserGuidePage;