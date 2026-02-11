// src/pages/PrivacyPolicy.tsx
import React from 'react';
import { AppLayout, ContentContainer, Card, ThemedImg } from '../components/layout/LayoutComponents';

const PrivacyPolicy: React.FC = () => {
    const sections = [
        {
            title: "Information We Collect",
            points: [
                "Account information (name, email, profile photo via Google OAuth)",
                "Usage data and interaction logs (pages visited, features used)",
                "Uploaded content (notes, documents, audio recordings, podcasts)",
                "Technical information (device type, browser, approximate location)"
            ]
        },
        {
            title: "How We Use Your Information",
            points: [
                "To provide, maintain, and improve our services",
                "To personalise your learning experience and AI responses",
                "To send notifications about quizzes, groups, and schedule events",
                "To ensure platform security, content moderation, and compliance"
            ]
        },
        {
            title: "AI Data Processing",
            points: [
                "Documents you upload are processed by AI models for analysis and chat",
                "Audio recordings are transcribed using speech-to-text services",
                "AI-generated content (summaries, quizzes, podcast scripts) is derived from your inputs",
                "We do not use your content to train third-party AI models"
            ]
        },
        {
            title: "Data Protection",
            points: [
                "Supabase infrastructure with row-level security (RLS) policies",
                "Encrypted data in transit (TLS) and at rest",
                "Regular security reviews and dependency audits",
                "Role-based access controls for all database operations"
            ]
        },
        {
            title: "Cookies & Analytics",
            points: [
                "Essential cookies for authentication and session management",
                "Local storage for theme preferences and offline capabilities",
                "We do not use third-party advertising trackers",
                "Anonymous usage analytics to improve the platform"
            ]
        },
        {
            title: "Your Rights",
            points: [
                "Access and download your personal data",
                "Request correction of inaccurate information",
                "Delete your account and all associated data from Settings",
                "Export your notes and documents",
                "Object to specific data processing activities"
            ]
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/settings-light.jpg" alt="Privacy Policy" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-gray-300 text-sm font-semibold tracking-widest uppercase mb-3">Your Data, Protected</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Privacy Policy</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Last updated: February 1, 2026. Learn how we protect and manage your personal information.
                        </p>
                    </div>
                </div>

                <div className="mb-12">
                    <Card className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Our Commitment to Privacy</h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            At StuddyHub AI, your privacy is fundamental — not an afterthought. This policy explains
                            what we collect, how we use it, and how you stay in control.
                        </p>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {sections.map((section, index) => (
                            <Card key={index} className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-3">{section.title}</h3>
                                <ul className="space-y-2">
                                    {section.points.map((point, idx) => (
                                        <li key={idx} className="text-gray-600 dark:text-gray-400 text-sm flex items-start gap-2">
                                            <span className="text-blue-500 mt-1">•</span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Data Storage & Security</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Storage Location</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    All data is stored on Supabase-managed infrastructure with PostgreSQL databases,
                                    object storage for files, and Edge Functions for server-side processing.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Retention Period</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    We retain your personal data only while your account is active, plus a short period
                                    for backups. You can request full deletion at any time from Settings.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Third-Party Sharing</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    We do not sell your personal information. Data is shared only with essential service
                                    providers (Supabase, OpenAI for AI features) under strict confidentiality agreements.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Contact Our Privacy Team</h3>

                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                If you have questions about this privacy policy or how we handle your data,
                                please reach out:
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h4>
                                    <p className="text-gray-600 dark:text-gray-400">studdyhubai@gmail.com</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Postal Address</h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Privacy Team<br />
                                        StuddyHub AI<br />
                                        University of Mines and Technology<br />
                                        Tarkwa, Ghana
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    We typically respond to privacy inquiries within 48 hours.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default PrivacyPolicy;