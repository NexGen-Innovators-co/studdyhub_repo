import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Sun, Moon, Users, Lightbulb, TrendingUp, Globe } from 'lucide-react';

const AboutUs: React.FC = () => {
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">About Us</h1>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-3xl mx-auto">
                    <p>
                        NoteMind AI was founded with a singular vision: to revolutionize the way students and professionals learn, organize, and thrive in their academic and professional lives. We believe that learning should be intuitive, personalized, and efficient.
                    </p>

                    <h2>Our Mission</h2>
                    <p>
                        Our mission is to empower individuals with intelligent tools that simplify complex information, foster deeper understanding, and enhance productivity. We are committed to leveraging cutting-edge AI to create a seamless and adaptive learning environment for everyone.
                    </p>

                    <h2>What We Offer</h2>
                    <p>NoteMind AI provides a suite of features designed to support your journey:</p>
                    <ul>
                        <li><strong>Intelligent Note-Taking:</strong> Summarize, organize, and extract insights from your notes automatically.</li>
                        <li><strong>Effortless Recording Analysis:</strong> Transcribe lectures and meetings, identifying key topics and speakers.</li>
                        <li><strong>Contextual AI Chat:</strong> Engage with an AI assistant that understands your personal learning context.</li>
                        <li><strong>Smart Document Insights:</strong> Analyze various document types to extract and make information searchable.</li>
                        <li><strong>Personalized Learning Paths:</strong> Adapt AI responses to match your unique learning style.</li>
                    </ul>

                    <h2>Our Values</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <div className="flex flex-col items-center text-center">
                            <Users className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-3" />
                            <h3 className="text-xl font-semibold mb-2">User-Centric</h3>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                                We design with our users at the core, ensuring our tools are intuitive and truly helpful.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <Lightbulb className="h-10 w-10 text-yellow-600 dark:text-yellow-400 mb-3" />
                            <h3 className="text-xl font-semibold mb-2">Innovation</h3>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                                We continuously explore and integrate the latest AI advancements to provide cutting-edge solutions.
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <TrendingUp className="h-10 w-10 text-green-600 dark:text-green-400 mb-3" />
                            <h3 className="text-xl font-semibold mb-2">Empowerment</h3>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                                Our goal is to empower every individual to achieve their full academic and professional potential.
                            </p>
                        </div>
                    </div>

                    <h2>Our Team</h2>
                    <p>
                        We are a passionate team of educators, AI researchers, and software engineers dedicated to creating impactful learning technologies. We believe in the power of AI to transform education and are excited to build the future of personalized learning.
                    </p>

                    <p>Thank you for being a part of the NoteMind AI community!</p>
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

export default AboutUs;
