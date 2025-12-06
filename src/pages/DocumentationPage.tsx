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
            <header className="w-full px-6 py-4 flex justify-between items-center z-50 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md fixed top-0">
                <Link to="/" className="flex items-center gap-3 group" aria-label="Home">
                    <img
                        src="https://placehold.co/32x32?text=Logo"
                        alt="studdyhub AI Logo"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                        loading="lazy"
                    />
                    <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">studdyhub AI</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link to="/auth">
                        <Button className="px-5 py-2 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Sign In</Button>
                    </Link>
                    <Button
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-6 py-12 mt-20 md:mt-24">
                <section className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-blue-600 dark:text-blue-400">studdyhub AI Documentation</h1>
                    <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
                        Comprehensive guides and references to help you get the most out of studdyhub AI.
                    </p>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Book className="h-6 w-6 text-blue-600" /> Getting Started</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            New to studdyhub AI? This section will guide you through the initial setup and core functionalities.
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                            <li>Quick Start Guide: Learn how to create your first note or schedule.</li>
                            <li>Account Setup: Customize your learning preferences.</li>
                        </ul>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Code className="h-6 w-6 text-green-600" /> API Reference</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Detailed documentation for our API endpoints.
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                            <li>Authentication & Authorization: Obtain API keys securely.</li>
                            <li>Endpoints: Parameters and response formats.</li>
                            <li>Code Examples: Snippets in popular languages.</li>
                            <li>Best Practices: Optimization and troubleshooting.</li>
                        </ul>
                    </div>
                </section>

                <section className="text-center mb-16">
                    <h2 className="text-2xl font-bold mb-4">User Guides & Tutorials</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                        Step-by-step instructions and video tutorials for all studdyhub AI features.
                    </p>
                    <Link to="/user-guide-page">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Explore User Guides</Button>
                    </Link>
                </section>

                <section className="text-center">
                    <h2 className="text-2xl font-bold mb-4">FAQs & Support</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                        Find answers to frequently asked questions or contact our support team for personalized assistance.
                    </p>
                    <Link to="/contact">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Contact Support</Button>
                    </Link>
                </section>
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