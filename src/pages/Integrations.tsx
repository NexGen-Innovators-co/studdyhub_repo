// src/pages/Integrations.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, Card, ThemedImg } from '../components/layout/LayoutComponents';
import { CheckCircle } from 'lucide-react';

const Integrations: React.FC = () => {
    const integrations = [
        {
            category: "Built-in AI Services",
            img: "/screenshots/chat-light.jpg",
            items: [
                { name: "OpenAI / GPT", status: "Available", desc: "Powers AI chat, document analysis, and quiz generation" },
                { name: "Whisper (Speech-to-Text)", status: "Available", desc: "Lecture transcription and podcast captioning" },
                { name: "AI Image Generation", status: "Available", desc: "Cover art and visual content for podcasts" }
            ]
        },
        {
            category: "Document & Storage",
            img: "/screenshots/documents-light.jpg",
            items: [
                { name: "PDF Upload & Analysis", status: "Available", desc: "Upload, parse, and chat with PDF documents" },
                { name: "Supabase Storage", status: "Available", desc: "Secure file storage for notes, recordings, and media" },
                { name: "Google Drive Import", status: "Planned", desc: "Import documents directly from your Drive" }
            ]
        },
        {
            category: "Communication & Social",
            img: "/screenshots/social-light.jpg",
            items: [
                { name: "Real-time Group Chat", status: "Available", desc: "Instant messaging in public and private study groups" },
                { name: "Push Notifications", status: "Available", desc: "Web push via VAPID for quiz invites & updates" },
                { name: "Discord Webhook", status: "Planned", desc: "Post study group activity to Discord channels" }
            ]
        },
        {
            category: "Productivity & Scheduling",
            img: "/screenshots/schedules-light.jpg",
            items: [
                { name: "Built-in Timetable", status: "Available", desc: "Calendar view with event management and reminders" },
                { name: "Google Calendar Sync", status: "Planned", desc: "Two-way sync with Google Calendar events" },
                { name: "iCal Export", status: "Planned", desc: "Export your schedule to any calendar app" }
            ]
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/settings-light.jpg" alt="StuddyHub Integrations" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/85 via-blue-900/80 to-indigo-900/75" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-cyan-300 text-sm font-semibold tracking-widest uppercase mb-3">Built-in & Upcoming</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Integrations</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            See what's already wired into StuddyHub AI and what's coming next.
                        </p>
                    </div>
                </div>

                <div className="mb-12">
                    {/* Stats bar */}
                    <Card className="mb-8">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">8</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Available Now</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">4</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">On the Roadmap</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Real-time</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Supabase Sync</div>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-10">
                        {integrations.map((category, index) => (
                            <div key={index}>
                                {/* Category header with photo */}
                                <div className="relative rounded-xl overflow-hidden mb-4 h-24">
                                    <ThemedImg src={category.img} alt={category.category} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50" />
                                    <div className="absolute inset-0 flex items-center px-6">
                                        <h3 className="text-xl font-bold text-white">{category.category}</h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {category.items.map((item, idx) => (
                                        <Card key={idx} className="hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold text-gray-900 dark:text-white">{item.name}</h4>
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Available'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                                    }`}>
                                                    {item.status === 'Available' && <CheckCircle className="h-3 w-3" />}
                                                    {item.status}
                                                </div>
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                {item.desc}
                                            </p>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom CTAs with photos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="overflow-hidden !p-0">
                        <ThemedImg src="/screenshots/dashboardanalytics-light.jpg" alt="Build with our API" className="w-full h-32 object-cover" />
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Build with Our API</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Want to extend StuddyHub AI programmatically? Our Supabase Edge Functions power a growing API surface.
                            </p>
                            <Link to="/api">
                                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                                    View API Docs
                                </button>
                            </Link>
                        </div>
                    </Card>

                    <Card className="overflow-hidden !p-0">
                        <ThemedImg src="/screenshots/recordings-light.jpg" alt="Request an integration" className="w-full h-32 object-cover" />
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Request an Integration</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Have a tool you'd like us to connect with? Drop us a message and we'll add it to the roadmap.
                            </p>
                            <Link to="/contact">
                                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium">
                                    Submit Request
                                </button>
                            </Link>
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Integrations;