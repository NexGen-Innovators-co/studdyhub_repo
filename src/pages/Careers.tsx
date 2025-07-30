import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Sun, Moon, Briefcase, Users, Code, Award, Globe } from 'lucide-react';

const Careers: React.FC = () => {
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

    const jobOpenings = [
        {
            id: 1,
            title: "Senior AI Engineer",
            location: "Remote",
            type: "Full-time",
            description: "Develop and implement advanced AI models for personalized learning experiences.",
            icon: Code
        },
        {
            id: 2,
            title: "Product Designer (UI/UX)",
            location: "Accra, Ghana",
            type: "Full-time",
            description: "Design intuitive and engaging user interfaces for our web and mobile applications.",
            icon: Sparkles
        },
        {
            id: 3,
            title: "Frontend Developer (React)",
            location: "Remote",
            type: "Full-time",
            description: "Build responsive and high-performance user interfaces using React and TypeScript.",
            icon: Code
        },
        {
            id: 4,
            title: "Content Strategist",
            location: "Remote",
            type: "Full-time",
            description: "Develop engaging educational content and learning materials for our AI-powered platform.",
            icon: Briefcase
        }
    ];

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
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">Careers at studdyhub AI</h1>
                <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto text-center mb-12">
                    Join our innovative team and help shape the future of personalized learning with AI.
                </p>

                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Why Work With Us?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="flex items-start gap-4">
                            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Impactful Work</h3>
                                <p className="text-gray-700 dark:text-gray-300">Contribute to a product that genuinely helps students learn better and more efficiently.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Award className="h-8 w-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Innovation at Core</h3>
                                <p className="text-gray-700 dark:text-gray-300">Work with cutting-edge AI technologies and push the boundaries of educational tech.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Briefcase className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Growth Opportunities</h3>
                                <p className="text-gray-700 dark:text-gray-300">Foster your professional development in a fast-paced, supportive environment.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Collaborative Culture</h3>
                                <p className="text-gray-700 dark:text-gray-300">Join a diverse and passionate team that values creativity and teamwork.</p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Current Openings</h2>
                    <div className="space-y-6">
                        {jobOpenings.map(job => (
                            <div key={job.id} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center">
                                <div className="flex items-center mb-4 md:mb-0">
                                    {React.createElement(job.icon, { className: "h-6 w-6 text-blue-500 dark:text-blue-300 mr-3 flex-shrink-0" })}
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{job.title}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">{job.location} &bull; {job.type}</p>
                                    </div>
                                </div>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg">
                                    Apply Now
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="text-center mt-12">
                        <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                            Don't see a role that fits? Send us your resume anyway! We're always looking for talented individuals.
                        </p>
                        <Link to="/contact">
                            <Button variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                                Contact Us
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

export default Careers;
