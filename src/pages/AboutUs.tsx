// src/pages/AboutUs.tsx
import React from 'react';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Sparkles, Users, Lightbulb, Target, Globe } from 'lucide-react';

const AboutUs: React.FC = () => {
    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="About StuddyHub AI"
                    subtitle="Our Story & Mission"
                    description="Transforming education through intelligent technology, one student at a time."
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Our Mission</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            To democratize access to quality education by providing AI-powered tools that adapt to individual
                            learning styles, making education more personalized, efficient, and accessible for students and
                            professionals worldwide.
                        </p>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Lightbulb className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Our Vision</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            To become Africa's leading AI-powered learning platform, bridging educational gaps and empowering
                            the next generation of innovators and leaders through cutting-edge technology.
                        </p>
                    </Card>
                </div>

                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What We Offer</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Intelligent Note-Taking</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        AI-powered summarization and organization of your study materials
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Voice Transcription</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Convert lectures and meetings into searchable, organized text
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Personalized AI Tutor</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        Context-aware AI assistant that adapts to your learning style
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Smart Scheduling</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        AI-optimized study plans and calendar management
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Users className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Our Team</h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        We're a passionate team of AI researchers, educators, and developers based at the
                        University of Mines and Technology in Tarkwa, Ghana. Our mission is to leverage
                        technology to solve real educational challenges.
                    </p>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">📍 Agri-IoT Lab, University of Mines and Technology, Tarkwa, Ghana</span>
                    </div>
                </Card>
            </ContentContainer>
        </AppLayout>
    );
};

export default AboutUs;