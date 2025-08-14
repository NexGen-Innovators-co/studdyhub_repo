import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Sun, Moon, Globe } from 'lucide-react';

const TermsOfService: React.FC = () => {
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
            <header className={`fixed w-full px-6 py-4 flex justify-between items-center z-50 transition-all duration-300 ${scrollY > 50
                ? 'bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md'
                : 'bg-transparent'
                }`}>
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">Terms of Service</h1>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-3xl mx-auto">
                    <p>Effective Date: July 30, 2025</p>
                    <p>
                        Welcome to studdyhub AI. These Terms of Service ("Terms") govern your access to and use of our website studdyhub.lovable.app and our services. By accessing or using our services, you agree to be bound by these Terms.
                    </p>

                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By creating an account, accessing, or using studdyhub AI, you confirm that you have read, understood, and agree to be bound by these Terms. If you do not agree with all of these Terms, then you are expressly prohibited from using the service and you must discontinue use immediately.
                    </p>

                    <h2>2. Changes to Terms</h2>
                    <p>
                        We reserve the right, in our sole discretion, to make changes or modifications to these Terms at any time and for any reason. We will alert you about any changes by updating the "Effective Date" of these Terms.
                    </p>

                    <h2>3. User Accounts</h2>
                    <ul>
                        <li>You must be at least 13 years old to use our service.</li>
                        <li>You are responsible for maintaining the confidentiality of your account password and are responsible for all activities that occur under your account.</li>
                        <li>You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.</li>
                    </ul>

                    <h2>4. Intellectual Property Rights</h2>
                    <p>
                        Unless otherwise indicated, the service is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the service (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.
                    </p>

                    <h2>5. Prohibited Activities</h2>
                    <p>You may not access or use the service for any purpose other than that for which we make the service available. The service may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
                    <p>Prohibited activities include, but are not limited to:</p>
                    <ul>
                        <li>Systematically retrieving data or other content from the service to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
                        <li>Making any unauthorized use of the service, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email.</li>
                        <li>Interfering with, disrupting, or creating an undue burden on the service or the networks or services connected to the service.</li>
                        <li>Using the service as part of any effort to compete with us or otherwise using the service and/or the Content for any revenue-generating endeavor or commercial enterprise.</li>
                    </ul>

                    <h2>6. Termination</h2>
                    <p>
                        We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                    </p>

                    <h2>7. Disclaimer of Warranties</h2>
                    <p>
                        The service is provided on an AS-IS and AS-AVAILABLE basis. You agree that your use of the service will be at your sole risk. To the fullest extent permitted by law, we disclaim all warranties, express or implied, in connection with the service and your use thereof.
                    </p>

                    <h2>8. Limitation of Liability</h2>
                    <p>
                        In no event will we or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages, including lost profit, lost revenue, loss of data, or other damages arising from your use of the service.
                    </p>

                    <h2>9. Governing Law</h2>
                    <p>
                        These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
                    </p>

                    <h2>10. Contact Us</h2>
                    <p>
                        If you have any questions about these Terms, please contact us:
                        <br />
                        By email: twenethomas36@gmail.com
                        <br />

                    </p>
                </div>
            </main>

            {/* Footer */}
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

export default TermsOfService;
