import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Sun, Moon, Plug, LayoutDashboard, FileText, Mic, Calendar, Globe } from 'lucide-react';

const Integrations: React.FC = () => {
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

    const integrationCategories = [
        {
            name: "Note-Taking & Document Management",
            icon: FileText,
            integrations: [
                { name: "Google Drive", description: "Sync your documents and notes from Google Drive for AI analysis.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/1200px-Google_Drive_icon_%282020%29.svg.png" },
                { name: "Dropbox", description: "Connect your Dropbox account to easily import and analyze files.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/1200px-Dropbox_Icon.svg.png" },
                { name: "Evernote", description: "Import your existing notes from Evernote for intelligent organization.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Evernote_logo.svg/1200px-Evernote_logo.svg.png" },
            ]
        },
        {
            name: "Productivity & Collaboration",
            icon: LayoutDashboard,
            integrations: [
                { name: "Slack", description: "Get AI summaries of discussions and action items directly in Slack channels.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/1200px-Slack_icon_2019.svg.png" },
                { name: "Microsoft Teams", description: "Integrate NoteMind AI with Teams for enhanced meeting insights.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Microsoft_Office_Teams_logo.svg/1200px-Microsoft_Office_Teams_logo.svg.png" },
                { name: "Zoom", description: "Transcribe and analyze Zoom meeting recordings automatically.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Zoom_Logo.svg/1200px-Zoom_Logo.svg.png" },
            ]
        },
        {
            name: "Calendar & Scheduling",
            icon: Calendar,
            integrations: [
                { name: "Google Calendar", description: "Sync your calendar to get AI-powered schedule optimization and reminders.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/1200px-Google_Calendar_icon_%282020%29.svg.png" },
                { name: "Outlook Calendar", description: "Connect with Outlook Calendar for seamless event and task management.", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Microsoft_Outlook_Logo.svg/1200px-Microsoft_Outlook_Logo.svg.png" },
            ]
        },
        {
            name: "Voice & Audio",
            icon: Mic,
            integrations: [
                { name: "Voice Recorder Apps", description: "Upload audio from your favorite voice recording apps for transcription and analysis.", logo: "https://placehold.co/100x100/A78BFA/FFFFFF?text=Audio" }, // Placeholder
            ]
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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">Integrations</h1>
                <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto text-center mb-12">
                    Connect NoteMind AI with your favorite apps and services to streamline your workflow.
                </p>

                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Seamlessly Connect Your Tools</h2>
                    <p className="mb-8 text-gray-700 dark:text-gray-300">
                        NoteMind AI works with the tools you already use, making it easy to bring your notes, documents, and recordings into our intelligent platform.
                    </p>

                    {integrationCategories.map((category, catIndex) => (
                        <div key={catIndex} className="mb-10">
                            <div className="flex items-center gap-3 mb-6">
                                {React.createElement(category.icon, { className: "h-8 w-8 text-blue-600 dark:text-blue-400" })}
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{category.name}</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {category.integrations.map((integration, intIndex) => (
                                    <div key={intIndex} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                                        <div className="w-12 h-12 flex-shrink-0">
                                            <img src={integration.logo} alt={`${integration.name} logo`} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = 'https://placehold.co/48x48/e0e0e0/666666?text=Logo'; }} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{integration.name}</h4>
                                            <p className="text-gray-700 dark:text-gray-300 text-sm">{integration.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="text-center mt-12">
                        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Don't See Your Favorite App?</h2>
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                            We're constantly expanding our integration library. Let us know what you'd like to see!
                        </p>
                        <Link to="/contact">
                            <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                                Suggest an Integration
                            </Button>
                        </Link>
                        <Link to="/api" className="ml-4">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                Build Your Own with Our API
                            </Button>
                        </Link>
                    </div>
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

export default Integrations;
