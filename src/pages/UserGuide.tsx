// src/pages/UserGuide.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Book, Lightbulb, Zap, FileText, Mic, LayoutDashboard, Calendar, Code, Users, TrendingUp, ChevronRight, ScrollText, Settings, HelpCircle, MessageSquare, Plug } from 'lucide-react';

const UserGuidePage: React.FC = () => {
    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="User Guide"
                    subtitle="Complete Documentation"
                    description="Everything you need to master StuddyHub AI and enhance your learning experience."
                />

                <div className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Link to="/docs/getting-started">
                            <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-1 group">
                                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                                    <Book className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Getting Started
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Learn the basics of setting up your account and navigating the platform.
                                </p>
                            </Card>
                        </Link>

                        <Link to="/docs/note-taking">
                            <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-1 group">
                                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                                    <ScrollText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    Note Taking
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Master intelligent note-taking with AI-powered summarization and organization.
                                </p>
                            </Card>
                        </Link>

                        <Link to="/docs/ai-chat">
                            <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-1 group">
                                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                                    <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    AI Assistant
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Get the most out of your AI learning companion with advanced tips and techniques.
                                </p>
                            </Card>
                        </Link>
                    </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Need More Help?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Can't find what you're looking for? Our support team is here to help you.
                        </p>
                        <Link to="/contact">
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                                Contact Support
                            </button>
                        </Link>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Video Tutorials</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Watch step-by-step video guides to master all features of StuddyHub AI.
                        </p>
                        <a href="/tutorials">
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium">
                                Watch Tutorials
                            </button>
                        </a>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default UserGuidePage;