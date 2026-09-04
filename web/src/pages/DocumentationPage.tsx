// src/pages/DocumentationPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, Card } from '../modules/layout/components/LayoutComponents';
import { Search, ArrowRight, BookOpen, Code2, LifeBuoy } from 'lucide-react';

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
            answer: "We use Google Gemini models for chat and analysis. Free users get Gemini Flash for fast responses, Scholar users get Gemini 2.5 Flash with enhanced reasoning, and Genius users get Gemini Pro for the most capable AI experience."
        },
        {
            question: "How do I contact support?",
            answer: "Use the contact form at /contact or email studdyhubai@gmail.com. We typically respond within 24 hours."
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <div className="grid lg:grid-cols-[1fr_0.8fr] gap-10 items-end mb-12">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C86] mb-4">Resources / Find your next step</p>
                        <h1 className="public-display text-5xl md:text-6xl font-normal text-[#122033] dark:text-white leading-tight mb-5">Documentation that gets you unstuck.</h1>
                        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">Start with the guide, browse a topic, or jump straight to the answers people ask most.</p>
                    </div>
                    <div className="study-strip p-4">
                        <label className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <Search className="h-4 w-4 text-[#2F5BEA]" />
                            <input aria-label="Search documentation" placeholder="Search the guides" className="w-full bg-transparent outline-none text-[#122033] dark:text-white placeholder:text-gray-400" />
                        </label>
                    </div>
                </div>

                <div className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                        {[
                            { title: 'Start here', description: 'Set up your first study session in a few minutes.', link: '/user-guide-page', icon: BookOpen, accent: '#2F5BEA' },
                            { title: 'For developers', description: 'Explore the architecture and internal API surface.', link: '/api', icon: Code2, accent: '#168C86' },
                            { title: 'Need a hand?', description: 'Find answers or send the team a message.', link: '/contact', icon: LifeBuoy, accent: '#E56B4D' },
                        ].map((entry) => (
                            <Link to={entry.link} key={entry.title} className="group border public-rule bg-white dark:bg-[#182431] p-5 hover:border-[#2F5BEA] transition-colors">
                                <entry.icon className="h-5 w-5 mb-8" style={{ color: entry.accent }} />
                                <h2 className="public-display text-2xl font-normal text-[#122033] dark:text-white mb-2">{entry.title}</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{entry.description}</p>
                                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#2F5BEA] inline-flex items-center gap-2">Open <ArrowRight className="h-3.5 w-3.5" /></span>
                            </Link>
                        ))}
                    </div>
                    <div className="border-t public-rule pt-8">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E56B4D] mb-3">Browse by topic</p>
                        <h2 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-6">Everything in StuddyHub, arranged for humans.</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {documentationSections.map((section, index) => (
                            <Link to={section.link} key={index}>
                                <div className="h-full border-b public-rule py-5 group">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-[#122033] dark:text-white mb-1 group-hover:text-[#2F5BEA] transition-colors">
                                                {section.title}
                                            </h3>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                                                {section.description}
                                            </p>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{section.items.length} topics</span>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-[#2F5BEA] mt-1 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="border-t public-rule pt-10">
                    <div className="max-w-2xl mb-8">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C86] mb-3">Quick answers</p>
                        <h2 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-2">Frequently asked questions</h2>
                        <p className="text-gray-600 dark:text-gray-300">Short answers for the moments when you need to keep moving.</p>
                    </div>

                    <div className="max-w-3xl space-y-0 border-t public-rule">
                        {faqs.map((faq, index) => (
                            <details key={index} className="border-b public-rule py-5 group">
                                <summary className="font-semibold text-[#122033] dark:text-white cursor-pointer list-none flex items-center justify-between gap-4">
                                    {faq.question}
                                    <span className="text-[#2F5BEA] text-xl font-normal group-open:rotate-45 transition-transform">+</span>
                                </summary>
                                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed pt-3 pr-8">
                                    {faq.answer}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default DocumentationPage;