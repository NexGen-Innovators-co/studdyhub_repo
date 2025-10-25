import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Sun, Moon, Code, Book, Zap, Globe } from 'lucide-react';

const APIPage: React.FC = () => {
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">studdyhub AI API</h1>
                <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto text-center mb-12">
                    Integrate studdyhub AI's powerful features directly into your applications.
                </p>

                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Overview</h2>
                    <p className="mb-6 text-gray-700 dark:text-gray-300">
                        The studdyhub AI API allows developers to programmatically access our core AI capabilities, including intelligent summarization, document analysis, and personalized learning insights. Build custom applications that leverage the power of studdyhub AI.
                    </p>

                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Key Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="flex items-start gap-4">
                            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Document Processing</h3>
                                <p className="text-gray-700 dark:text-gray-300">Upload and get structured insights from various document types (PDFs, text, images).</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Zap className="h-8 w-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">AI Chat Integration</h3>
                                <p className="text-gray-700 dark:text-gray-300">Embed our contextual AI chat functionality into your own platforms.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Personalization Engine</h3>
                                <p className="text-gray-700 dark:text-gray-300">Access and apply personalized learning style adaptations for users.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Code className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Code Generation (Diagrams)</h3>
                                <p className="text-gray-700 dark:text-gray-300">Generate Mermaid, DOT, Chart.js, and Three.js code programmatically.</p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Getting Started</h2>
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                        To start using the studdyhub AI API, you'll need an API key.
                    </p>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg">
                        Get Your API Key
                    </Button>

                    <h2 className="text-3xl font-bold mt-10 mb-6 text-gray-900 dark:text-white">Documentation</h2>
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Our comprehensive API documentation provides detailed information on endpoints, request/response formats, and code examples.
                    </p>
                    <Link to="/documentation-page">
                        <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                            View API Documentation
                        </Button>
                    </Link>

                    <h2 className="text-3xl font-bold mt-10 mb-6 text-gray-900 dark:text-white">Support</h2>
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Need help integrating? Our developer support team is here to assist you.
                    </p>
                    <Link to="/contact">
                        <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                            Contact Support
                        </Button>
                    </Link>
                </div>
            </main>

            <footer className="py-16 px-6 bg-gray-800 dark:bg-black text-gray-300">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <img
                                src="/siteimage.png"
                                alt="studdyhub AI Logo"
                                className="h-12 w-12 object-contain group-hover:scale-110 transition-transform"
                            />
                            <span className="text-2xl font-extrabold text-white">studdyhub AI</span>
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
                                    alt="studdyhub AI Logo"
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
                    <p>&copy; {new Date().getFullYear()} studdyhub AI. All rights reserved.</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default APIPage;
