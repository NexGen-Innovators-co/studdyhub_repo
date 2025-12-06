import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Sun, Moon, Globe } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
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
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-blue-600 dark:text-blue-400">Privacy Policy</h1>
                    <p className="text-lg text-gray-700 dark:text-gray-300">Effective Date: July 30, 2025</p>
                </section>

                <section className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-3xl mx-auto">
                    <p>
                        Welcome to studdyhub AI. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website studdyhub.lovable.app and use our services.
                    </p>

                    <h2>1. Information We Collect</h2>
                    <h3>Personal Data:</h3>
                    <ul>
                        <li><strong>Account Information:</strong> When you register for an account, we collect your name, email address, and password.</li>
                        <li><strong>Usage Data:</strong> Information about how you access and use our services, including chat history, uploaded documents, voice recordings, and interactions with AI features.</li>
                        <li><strong>Payment Data:</strong> If you subscribe to paid services, we collect payment information (processed by a third-party payment processor).</li>
                    </ul>
                    <h3>Non-Personal Data:</h3>
                    <ul>
                        <li><strong>Technical Data:</strong> IP address, browser type, operating system, device information, and access times.</li>
                        <li><strong>Cookies and Similar Technologies:</strong> We use cookies to enhance your experience, analyze usage, and provide personalized content.</li>
                    </ul>

                    <h2>2. How We Use Your Information</h2>
                    <ul>
                        <li>To provide and maintain our services.</li>
                        <li>To personalize your experience and improve our AI models.</li>
                        <li>To communicate with you about updates, promotions, and support.</li>
                        <li>To analyze usage patterns and improve our platform.</li>
                        <li>To comply with legal obligations and protect our rights.</li>
                    </ul>

                    <h2>3. Sharing Your Information</h2>
                    <p>
                        We do not sell your personal information. We may share it with:
                    </p>
                    <ul>
                        <li>Service providers (e.g., cloud hosting, payment processors).</li>
                        <li>Legal authorities if required by law.</li>
                        <li>Business partners in case of merger or acquisition.</li>
                    </ul>

                    <h2>4. Security</h2>
                    <p>
                        We implement industry-standard security measures to protect your data. However, no method is 100% secure, so we cannot guarantee absolute security.
                    </p>

                    <h2>5. Your Rights</h2>
                    <p>
                        You have the right to access, update, delete, or export your data. Contact us at support@studdyhubai.com.
                    </p>

                    <h2>6. Changes to This Privacy Policy</h2>
                    <p>
                        We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Effective Date" at the top.
                    </p>

                    <h2>7. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us:
                        <br />
                        By email: support@studdyhubai.com
                    </p>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-16 px-6 bg-gray-800 dark:bg-black text-gray-300">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <img
                                src="https://placehold.co/48x48?text=Logo"
                                alt="studdyhub AI Logo"
                                className="h-12 w-12 object-contain"
                                loading="lazy"
                            />
                            <span className="text-2xl font-extrabold text-white">studdyhub AI</span>
                        </div>
                        <p className="text-gray-400 leading-relaxed mb-6">
                            Empowering students and professionals to achieve more with intelligent tools for notes, recordings, and schedules.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors" aria-label="Global">
                                <Globe className="h-5 w-5" />
                            </a>
                            <a href="#" className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors" aria-label="Logo Link">
                                <img
                                    src="https://placehold.co/32x32?text=Logo"
                                    alt="studdyhub AI Logo"
                                    className="h-8 w-8 object-contain"
                                    loading="lazy"
                                />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-white font-semibold mb-4">Product</h3>
                        <ul className="space-y-3 text-gray-400">
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

export default PrivacyPolicy;