import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Sun, Moon, Book, Code, Zap, Lightbulb } from 'lucide-react';

const DocumentationPage: React.FC = () => {
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

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased flex flex-col">
            {/* Header */}
            <header className="w-full px-6 py-4 flex justify-between items-center z-50 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md">
                <Link to="/" className="flex items-center gap-3 group">
                    <img
                        src="/siteimage.png"
                        alt="studdyhub AI Logo"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                    />
                    <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">studdyhub AI</span>
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">studdyhub AI Documentation</h1>
                <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto text-center mb-12">
                    Comprehensive guides and references to help you get the most out of studdyhub AI.
                </p>

                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Getting Started</h2>
                    <p className="mb-6 text-gray-700 dark:text-gray-300">
                        New to studdyhub AI? This section will guide you through the initial setup and core functionalities.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="flex items-start gap-4">
                            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Quick Start Guide</h3>
                                <p className="text-gray-700 dark:text-gray-300">Learn how to create your first notes, upload documents, and start chatting with AI.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Lightbulb className="h-8 w-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Understanding AI Features</h3>
                                <p className="text-gray-700 dark:text-gray-300">Dive deeper into how our AI processes information and generates insights.</p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">API Documentation</h2>
                    <p className="mb-6 text-gray-700 dark:text-gray-300">
                        For developers looking to integrate studdyhub AI's powerful features into their own applications.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="flex items-start gap-4">
                            <Code className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Authentication & Authorization</h3>
                                <p className="text-gray-700 dark:text-gray-300">Details on how to obtain API keys and authenticate your requests securely.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">API Endpoints Reference</h3>
                                <p className="text-gray-700 dark:text-gray-300">A complete list of available API endpoints, their parameters, and response formats.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Book className="h-8 w-8 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Code Examples & SDKs</h3>
                                <p className="text-gray-700 dark:text-gray-300">Practical code snippets and guides for integrating with popular programming languages.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Lightbulb className="h-8 w-8 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Best Practices & Troubleshooting</h3>
                                <p className="text-gray-700 dark:text-gray-300">Tips for optimizing your API usage and resolving common issues.</p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">User Guides & Tutorials</h2>
                    <p className="mb-6 text-gray-700 dark:text-gray-300">
                        Step-by-step instructions and video tutorials for all studdyhub AI features.
                    </p>
                    <div className="text-center">
                        <Link to="/user-guide-page">
                            <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                                Explore User Guides
                            </Button>
                        </Link>
                    </div>

                    <h2 className="text-3xl font-bold mt-10 mb-6 text-gray-900 dark:text-white">FAQs & Support</h2>
                    <p className="mb-6 text-gray-700 dark:text-gray-300">
                        Find answers to frequently asked questions or contact our support team for personalized assistance.
                    </p>
                    <div className="text-center">
                        <Link to="/contact">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                Contact Support
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-10 px-6 bg-gray-800 dark:bg-black text-gray-300 text-center">
                <div className="max-w-6xl mx-auto">
                    <p>&copy; {new Date().getFullYear()} studdyhub AI. All rights reserved.</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DocumentationPage;
