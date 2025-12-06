import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
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
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-blue-600 dark:text-blue-400">Careers at studdyhub AI</h1>
                    <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
                        Join our innovative team and help shape the future of AI-powered learning. We're looking for passionate individuals to drive our mission forward.
                    </p>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                    {jobOpenings.map((job) => (
                        <article key={job.id} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
                            <job.icon className="h-8 w-8 text-blue-600 mb-4" />
                            <h2 className="text-xl font-bold mb-2">{job.title}</h2>
                            <p className="text-gray-700 dark:text-gray-300 mb-4">{job.description}</p>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                <p><strong>Location:</strong> {job.location}</p>
                                <p><strong>Type:</strong> {job.type}</p>
                            </div>
                        </article>
                    ))}
                </section>

                <section className="text-center">
                    <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                        Don't see a role that fits? Send us your resume anyway! We're always looking for talented individuals.
                    </p>
                    <Link to="/contact">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Contact Us</Button>
                    </Link>
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

export default Careers;