import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Sparkles, Sun, Moon, Mail, Phone, MapPin, Loader2, CheckCircle, Globe } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';

const Contact: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitSuccess(false);
        setSubmitError(null);

        // Simulate API call (replace with real fetch to your backend)
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

            if (formData.name === "Error") { // Simulate error
                throw new Error("Simulated submission error. Please try again.");
            }

            setSubmitSuccess(true);
            setFormData({ name: '', email: '', subject: '', message: '' });
        } catch (error: any) {
            setSubmitError(error.message || "Failed to send message. Please try again later.");
        } finally {
            setIsSubmitting(false);
        }
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
            <main className="flex-1 container mx-auto px-6 py-12 mt-20 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-8">
                <section>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-blue-600 dark:text-blue-400">Contact Us</h1>
                    <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
                        Have questions or feedback? Reach out to our team – we're here to help!
                    </p>
                    <div className="space-y-4 text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2"><Mail className="h-5 w-5" /> support@studdyhubai.com</div>
                        <div className="flex items-center gap-2"><Phone className="h-5 w-5" /> +1 (123) 456-7890</div>
                        <div className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Accra, Ghana</div>
                    </div>
                </section>

                <section className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="name" className="block text-sm font-medium mb-1">Name</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required className="w-full" />
                        </div>
                        <div>
                            <Label htmlFor="email" className="block text-sm font-medium mb-1">Email</Label>
                            <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full" />
                        </div>
                        <div>
                            <Label htmlFor="subject" className="block text-sm font-medium mb-1">Subject</Label>
                            <Input id="subject" name="subject" value={formData.subject} onChange={handleChange} required className="w-full" />
                        </div>
                        <div>
                            <Label htmlFor="message" className="block text-sm font-medium mb-1">Message</Label>
                            <Textarea id="message" name="message" value={formData.message} onChange={handleChange} required className="w-full min-h-[150px]" />
                        </div>
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null} Send Message
                        </Button>
                        {submitSuccess && (
                            <div className="p-3 bg-green-100 text-green-700 rounded-md flex items-center gap-2 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle className="h-5 w-5" /> Message sent successfully! We'll get back to you soon.
                            </div>
                        )}
                        {submitError && (
                            <div className="p-3 bg-red-100 text-red-700 rounded-md flex items-center gap-2 dark:bg-red-900/30 dark:text-red-300">
                                {submitError}
                            </div>
                        )}
                    </form>
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

export default Contact;