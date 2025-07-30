import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Sun, Moon, Rss, Calendar, User, Globe } from 'lucide-react';

const Blog: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = React.useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    React.useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode);
    };

    const blogPosts = [
        {
            id: 1,
            title: "The Future of Learning: How AI is Transforming Education",
            summary: "Explore how artificial intelligence is set to revolutionize educational methodologies, making learning more personalized and efficient.",
            author: "NoteMind AI Team",
            date: "July 25, 2025",
            imageUrl: "https://placehold.co/600x400/A78BFA/FFFFFF?text=AI+Learning"
        },
        {
            id: 2,
            title: "Mastering Your Notes with Intelligent Summarization",
            summary: "Discover techniques and features within NoteMind AI that help you condense vast amounts of information into digestible summaries.",
            author: "Dr. Anya Sharma",
            date: "July 18, 2025",
            imageUrl: "https://placehold.co/600x400/60A5FA/FFFFFF?text=Note+Taking"
        },
        {
            id: 3,
            title: "Voice to Text: Unlocking Insights from Your Lectures",
            summary: "Learn how NoteMind AI's advanced transcription and analysis features can turn your spoken words into actionable insights.",
            author: "Michael Lee",
            date: "July 10, 2025",
            imageUrl: "https://placehold.co/600x400/34D399/FFFFFF?text=Voice+AI"
        },
        {
            id: 4,
            title: "Personalized Learning Paths: Tailoring AI to Your Style",
            summary: "Understand how NoteMind AI adapts to visual, auditory, kinesthetic, and reading/writing learning styles for a truly unique experience.",
            author: "Sarah Chen",
            date: "July 01, 2025",
            imageUrl: "https://placehold.co/600x400/FBBF24/FFFFFF?text=Personalized+Learning"
        }
    ];

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased flex flex-col">
            {/* Header */}
            <header className="w-full px-6 py-4 flex justify-between items-center z-50 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md">
                <Link to="/" className="flex items-center gap-3 group">
                    <img
                        src="/siteimage.png"
                        alt="NoteMind AI Logo"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                    />
                    <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">NoteMind AI</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link to="/auth">
                        <Button type="button" className="px-5 py-2 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Sign In</Button>
                    </Link>
                    <Button
                        type="button"
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-6 py-12 mt-20 md:mt-24">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">Our Blog</h1>
                <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto text-center mb-12">
                    Stay updated with the latest insights, tips, and news from NoteMind AI.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.map(post => (
                        <div key={post.id} className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden transform hover:scale-105 transition-transform duration-300">
                            <img src={post.imageUrl} alt={post.title} className="w-full h-48 object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400/e0e0e0/666666?text=Image+Error'; }} />
                            <div className="p-6">
                                <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{post.title}</h2>
                                <p className="text-gray-700 dark:text-gray-300 mb-4">{post.summary}</p>
                                <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                                    <User className="h-4 w-4 mr-2" /> {post.author}
                                    <Calendar className="h-4 w-4 ml-4 mr-2" /> {post.date}
                                </div>
                                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                    <Link to={`/blog/${post.id}`}>Read More</Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-16">
                    <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                        <Rss className="h-5 w-5 mr-2" /> Subscribe to RSS
                    </Button>
                </div>
            </main>

            <footer className="py-16 px-6 bg-gray-800 dark:bg-black text-gray-300">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <img
                                src="/siteimage.png"
                                alt="NoteMind AI Logo"
                                className="h-12 w-12 object-contain group-hover:scale-110 transition-transform"
                            />
                            <span className="text-2xl font-extrabold text-white">NoteMind AI</span>
                        </div>
                        <p className="text-gray-400 leading-relaxed mb-6">
                            Empowering students and professionals to achieve more with intelligent tools for notes, recordings, and schedules.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                                <Globe className="h-5 w-5" />
                            </a>
                            <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                                <img
                                    src="/siteimage.png"
                                    alt="NoteMind AI Logo"
                                    className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                                />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-white font-semibold mb-4">Product</h3>
                        <ul className="space-y-3 text-gray-400">
                            {/* <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                            <li><a href="#cta" className="hover:text-white transition-colors">Pricing</a></li> */}
                            <li><a href="api" className="hover:text-white transition-colors">API</a></li>
                            <li><a href="integrations" className="hover:text-white transition-colors">Integrations</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-white font-semibold mb-4">Company</h3>
                        <ul className="space-y-3 text-gray-400">
                            <li><a href="/about-us" className="hover:text-white transition-colors">About Us</a></li>
                            <li><a href="/blogs" className="hover:text-white transition-colors">Blog</a></li>
                            <li><a href="careers" className="hover:text-white transition-colors">Careers</a></li>
                            <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-700 pt-8 mt-12 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} NoteMind AI. All rights reserved.</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Blog;
