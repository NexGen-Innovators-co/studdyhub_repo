// src/pages/DocumentationPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, SectionHeading, Card, ThemedImg } from '../components/layout/LayoutComponents';

const DocumentationPage: React.FC = () => {
    const documentationSections = [
        {
            title: "User Guide",
            description: "Complete walkthrough of every feature",
            items: [
                "Getting Started & Onboarding",
                "AI Chat & Document Analysis",
                "Recording & Transcription",
                "Study Groups & Social Features"
            ],
            link: "/user-guide-page",
            img: "/screenshots/dashboard-light.jpg"
        },
        {
            title: "Podcasts & Audio",
            description: "Create, share, and listen to study audio",
            items: [
                "Creating a Podcast",
                "AI-Generated Scripts & Covers",
                "Chunked Upload & Streaming",
                "Social Sharing & Playlists"
            ],
            link: "/user-guide-page",
            img: "/screenshots/recordings-light.jpg"
        },
        {
            title: "API Reference",
            description: "Edge Functions & developer docs",
            items: [
                "Supabase Edge Functions",
                "Authentication & RLS",
                "Realtime Subscriptions",
                "Storage Buckets"
            ],
            link: "/api",
            img: "/screenshots/settings-light.jpg"
        },
        {
            title: "Schedule & Quizzes",
            description: "Timetable management and live quizzes",
            items: [
                "Creating Events & Recurring Rules",
                "Calendar & List Views",
                "Live Quiz Sessions",
                "Quiz Scheduling & Auto-Mode"
            ],
            link: "/user-guide-page",
            img: "/screenshots/schedules-light.jpg"
        },
        {
            title: "Groups & Social",
            description: "Collaborate with classmates",
            items: [
                "Joining & Creating Groups",
                "Sharing Notes & Recordings",
                "Group Chat & Notifications",
                "Privacy Settings"
            ],
            link: "/user-guide-page",
            img: "/screenshots/social-light.jpg"
        },
        {
            title: "Support",
            description: "Get help when you need it",
            items: [
                "FAQs & Troubleshooting",
                "Contact Support",
                "Feature Requests",
                "Bug Reporting"
            ],
            link: "/contact",
            img: "/screenshots/chat-light.jpg"
        }
    ];

    const faqs = [
        {
            question: "How do I reset my password?",
            answer: "Visit the login page and click 'Forgot Password'. Follow the instructions sent to your email. If you signed up with Google, use Google sign-in instead."
        },
        {
            question: "Is my data secure?",
            answer: "Yes. We use Supabase with row-level security policies, encrypted storage, and TLS for all network traffic. We never sell your data."
        },
        {
            question: "Can I export my notes and recordings?",
            answer: "Notes can be exported as PDF. Audio recordings and podcast files can be downloaded directly from their respective pages."
        },
        {
            question: "How do live quizzes work?",
            answer: "Create a quiz from your notes, invite classmates via a join code, and compete in real-time with a live leaderboard — similar to Kahoot."
        },
        {
            question: "What AI models does StuddyHub use?",
            answer: "We use OpenAI models (GPT-4o-mini and GPT-4o) for chat and analysis, plus Whisper for audio transcription. Model selection depends on your subscription tier."
        },
        {
            question: "How do I contact support?",
            answer: "Use the contact form at /contact or email studdyhubai@gmail.com. We typically respond within 24 hours."
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/documents-light.jpg" alt="StuddyHub Documentation" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/85 to-indigo-900/80" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-blue-300 text-sm font-semibold tracking-widest uppercase mb-3">Resources & Guides</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Documentation</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Everything you need to make the most of StuddyHub AI's features and capabilities.
                        </p>
                    </div>
                </div>

                <div className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {documentationSections.map((section, index) => (
                            <Link to={section.link} key={index}>
                                <Card className="h-full hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group overflow-hidden !p-0">
                                    <ThemedImg src={section.img} alt={section.title} className="w-full h-32 object-cover" />
                                    <div className="p-5">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {section.title}
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                                            {section.description}
                                        </p>
                                        <ul className="space-y-1.5">
                                            {section.items.map((item, idx) => (
                                                <li key={idx} className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <Card>
                        <SectionHeading title="Frequently Asked Questions" description="Quick answers to the most common queries." />

                        <div className="space-y-5">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-5 last:border-0 last:pb-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                        {faq.question}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default DocumentationPage;