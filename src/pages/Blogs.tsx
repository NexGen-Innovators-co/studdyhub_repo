// src/pages/Blogs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, Card, ThemedImg } from '../components/layout/LayoutComponents';
import { Calendar, User, ArrowRight, Clock, Tag } from 'lucide-react';

const Blog: React.FC = () => {
    const blogPosts = [
        {
            id: 1,
            title: "How AI-Powered Study Podcasts Are Changing the Way Students Learn",
            summary: "Discover how StuddyHub's podcast feature lets you record study sessions, auto-transcribe them, and share audio notes with classmates for on-the-go revision.",
            author: "StuddyHub AI Team",
            date: "February 5, 2026",
            readTime: "6 min read",
            category: "Podcasts",
            img: "/screenshots/social-light.jpg"
        },
        {
            id: 2,
            title: "Live Quizzes: Bringing Kahoot-Style Fun to Your Study Group",
            summary: "Learn how our live quiz feature turns studying into a social, competitive experience — create quizzes from your notes and challenge your classmates in real time.",
            author: "Thomas Appiah",
            date: "January 28, 2026",
            readTime: "5 min read",
            category: "Quizzes & Social",
            img: "/screenshots/quizzes-ight.jpg",
            imgDark: "/screenshots/quizzes-dark.jpg"
        },
        {
            id: 3,
            title: "From PDF to Conversation: Chat With Any Document Using AI",
            summary: "Upload your lecture slides, textbooks, or research papers and ask questions directly — StuddyHub's document analysis turns static files into interactive study partners.",
            author: "Isabel Anane",
            date: "January 15, 2026",
            readTime: "7 min read",
            category: "Document Analysis",
            img: "/screenshots/documents-light.jpg"
        },
        {
            id: 4,
            title: "Mastering Your Schedule: Smart Timetable Management for Students",
            summary: "Recurring events, conflict detection, and countdown timers — explore how the schedule module keeps you organised throughout the semester.",
            author: "Dr. Okai",
            date: "January 5, 2026",
            readTime: "4 min read",
            category: "Productivity",
            img: "/screenshots/schedules-light.jpg"
        },
        {
            id: 5,
            title: "Voice-to-Text: Never Miss a Detail in Your Lectures Again",
            summary: "Record lectures directly in the app and get accurate, searchable transcripts with automatic chapter markers and AI-generated summaries.",
            author: "StuddyHub AI Team",
            date: "December 20, 2025",
            readTime: "5 min read",
            category: "Recordings",
            img: "/screenshots/recordings-light.jpg"
        },
        {
            id: 6,
            title: "Building a Learning Community: Social Features in StuddyHub AI",
            summary: "From study groups and shared resources to notifications and direct messages, see how social learning accelerates academic performance.",
            author: "Thomas Appiah",
            date: "December 10, 2025",
            readTime: "6 min read",
            category: "Social Learning",
            img: "/screenshots/chat-light.jpg"
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/notes-light.jpg" alt="StuddyHub Blog" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-orange-300 text-sm font-semibold tracking-widest uppercase mb-3">Latest Insights</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Our Blog</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Tips, tutorials, and product updates on AI-powered studying, productivity, and educational technology.
                        </p>
                    </div>
                </div>

                {/* Featured post — wide card with photo */}
                <div className="mb-12">
                    <Card className="group hover:shadow-xl transition-all overflow-hidden !p-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            <ThemedImg src={blogPosts[0].img} darkSrc={(blogPosts[0] as any).imgDark} alt={blogPosts[0].title} className="w-full h-64 lg:h-full object-cover" />
                            <div className="p-8 flex flex-col justify-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium w-fit mb-4">
                                    <Tag className="h-3 w-3" />
                                    {blogPosts[0].category}
                                </span>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {blogPosts[0].title}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                                    {blogPosts[0].summary}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" />
                                        {blogPosts[0].author}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {blogPosts[0].date}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Remaining posts grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {blogPosts.slice(1).map((post) => (
                        <Card key={post.id} className="group hover:shadow-xl transition-shadow duration-300 hover:-translate-y-1 flex flex-col overflow-hidden !p-0">
                            <ThemedImg src={post.img} darkSrc={(post as any).imgDark} alt={post.title} className="w-full h-44 object-cover" />
                            <div className="p-5 flex-1 flex flex-col space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                                        <Tag className="h-3 w-3" />
                                        {post.category}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                                    {post.title}
                                </h3>

                                <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 flex-1">
                                    {post.summary}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{post.author}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {post.date}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            {post.readTime}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                        More articles coming soon — follow us for updates.
                    </p>
                    <Link to="/contact">
                        <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all">
                            Subscribe for Updates
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </Link>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Blog;