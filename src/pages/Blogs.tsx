// src/pages/Blogs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Calendar, User, ArrowRight, Clock, Tag } from 'lucide-react';

const Blog: React.FC = () => {
    const blogPosts = [
        {
            id: 1,
            title: "The Future of Learning: How AI is Transforming Education",
            summary: "Explore how artificial intelligence is revolutionizing educational methodologies and making learning more personalized.",
            author: "StuddyHub AI Team",
            date: "July 25, 2025",
            readTime: "5 min read",
            category: "AI & Education",
            imageColor: "from-blue-500 to-blue-700"
        },
        {
            id: 2,
            title: "Mastering Your Notes with Intelligent Summarization",
            summary: "Discover techniques and features within StuddyHub AI that help you condense information into digestible summaries.",
            author: "Thomas Appiah",
            date: "July 18, 2025",
            readTime: "4 min read",
            category: "Productivity",
            imageColor: "from-green-500 to-green-700"
        },
        {
            id: 3,
            title: "Voice to Text: Unlocking Insights from Your Lectures",
            summary: "Learn how StuddyHub AI's transcription and analysis features can turn spoken words into actionable insights.",
            author: "Isabel Anane",
            date: "July 10, 2025",
            readTime: "6 min read",
            category: "Technology",
            imageColor: "from-purple-500 to-purple-700"
        },
        {
            id: 4,
            title: "Personalized Learning Paths: Tailoring AI to Your Style",
            summary: "Understand how StuddyHub AI adapts to different learning styles for a truly unique educational experience.",
            author: "Dr. Okai",
            date: "July 01, 2025",
            readTime: "7 min read",
            category: "Learning",
            imageColor: "from-orange-500 to-orange-700"
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Our Blog"
                    subtitle="Latest Insights"
                    description="Stay updated with the latest insights on AI in education, learning tips, and product updates."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {blogPosts.map((post) => (
                        <Card key={post.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className={`h-48 ${post.imageColor} rounded-t-xl mb-6`}></div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                                        <Tag className="h-3 w-3" />
                                        {post.category}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {post.title}
                                </h3>

                                <p className="text-gray-600 dark:text-gray-400 line-clamp-3">
                                    {post.summary}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <User className="h-4 w-4" />
                                        <span>{post.author}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            {post.date}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {post.readTime}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="text-center">
                    <Link to="/blogs">
                        <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all">
                            View All Articles
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </Link>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Blog;