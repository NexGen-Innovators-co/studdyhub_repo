import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">Privacy Policy</h1>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-3xl mx-auto">
                    <p>Effective Date: July 30, 2025</p>
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
                        <li><strong>Cookies and Tracking Technologies:</strong> We use cookies to track activity on our service and hold certain information.</li>
                    </ul>

                    <h2>2. How We Use Your Information</h2>
                    <p>We use the information we collect for various purposes, including:</p>
                    <ul>
                        <li>To provide, operate, and maintain our services.</li>
                        <li>To personalize your experience and adapt AI responses to your learning style.</li>
                        <li>To process transactions and manage your subscriptions.</li>
                        <li>To improve our services, develop new features, and conduct research.</li>
                        <li>To communicate with you, including sending updates, security alerts, and support messages.</li>
                        <li>To detect, prevent, and address technical issues and fraudulent activity.</li>
                    </ul>

                    <h2>3. Disclosure of Your Information</h2>
                    <p>We may share information in the following situations:</p>
                    <ul>
                        <li><strong>With Service Providers:</strong> We may share your data with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf.</li>
                        <li><strong>For Legal Reasons:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities.</li>
                        <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                        <li><strong>With Your Consent:</strong> We may disclose your personal information for any other purpose with your consent.</li>
                    </ul>

                    <h2>4. Data Security</h2>
                    <p>
                        We implement reasonable security measures designed to protect your personal information from unauthorized access, use, or disclosure. However, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
                    </p>

                    <h2>5. Your Data Protection Rights</h2>
                    <p>Depending on your location, you may have the following rights regarding your personal data:</p>
                    <ul>
                        <li>The right to access, update, or delete the information we have on you.</li>
                        <li>The right to rectify any inaccurate information.</li>
                        <li>The right to object to our processing of your personal data.</li>
                        <li>The right to request the restriction of the processing of your personal data.</li>
                        <li>The right to data portability.</li>
                        <li>The right to withdraw consent at any time.</li>
                    </ul>
                    <p>To exercise any of these rights, please contact us at [Your Contact Email].</p>

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

export default PrivacyPolicy;