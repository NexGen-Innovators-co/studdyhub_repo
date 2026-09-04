// src/pages/ContactUs.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, Card } from '../modules/layout/components/LayoutComponents';
import { Mail, Phone, MapPin, Send, CheckCircle, Clock } from 'lucide-react';

const quickLinks = [
    { label: 'FAQs', href: '/documentation-page', desc: 'Find answers to common questions' },
    { label: 'User Guide', href: '/user-guide-page', desc: 'Step-by-step feature walkthroughs' },
    { label: 'Feedback', href: '/contact', desc: 'Share ideas or report issues' },
];

const Contact: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSubmitSuccess(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setIsSubmitting(false);
        setTimeout(() => setSubmitSuccess(false), 5000);
    };

    return (
        <AppLayout>
            <ContentContainer>
                <div className="max-w-3xl mb-12">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E56B4D] mb-4">Contact / We read every message</p>
                    <h1 className="public-display text-5xl md:text-6xl font-normal text-[#122033] dark:text-white leading-tight mb-5">Let’s get the right conversation started.</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">Support, feedback, partnerships, and press all start here. Tell us what you need and we’ll route it to the right person.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-y public-rule mb-12">
                    {quickLinks.map((q, i) => (
                        <Link key={i} to={q.href}>
                            <div className="group h-full p-5 sm:border-r last:border-r-0 public-rule hover:bg-white dark:hover:bg-[#182431] transition-colors">
                                <h4 className="font-semibold text-[#122033] dark:text-white text-sm group-hover:text-[#2F5BEA] transition-colors">{q.label}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{q.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Contact Info — 2 cols */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="study-strip p-6 h-auto">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168C86] mb-3">Before you write</p>
                            <h2 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-6">Contact information</h2>

                            <div className="space-y-5">
                                <div className="flex items-start gap-4">
                                    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">Our Location</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                            Agri-IoT Laboratory<br />
                                            University of Mines and Technology<br />
                                            Tarkwa, Ghana
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <Phone className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">Phone</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">+233 27 169 2568</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">Email</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">studdyhubai@gmail.com</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">Response Time</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">We aim to respond within 24 hours on business days.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form — 3 cols */}
                    <div className="lg:col-span-3">
                        <div className="bg-white dark:bg-[#182431] border public-rule p-6 md:p-8">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E56B4D] mb-3">Your message</p>
                            <h2 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-6">Send us a message</h2>

                            {submitSuccess && (
                                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                        <CheckCircle className="h-5 w-5" />
                                        <span className="font-medium">Message sent successfully!</span>
                                    </div>
                                    <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                                        We'll get back to you within 24 hours.
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                            placeholder="John Doe"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Subject *
                                    </label>
                                    <select
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                                    >
                                        <option value="">Select a topic...</option>
                                        <option value="general">General Inquiry</option>
                                        <option value="support">Technical Support</option>
                                        <option value="feedback">Feature Feedback</option>
                                        <option value="bug">Bug Report</option>
                                        <option value="partnership">Partnership / Business</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Message *
                                    </label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={5}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none text-sm"
                                        placeholder="Tell us how we can help..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4" />
                                            Send Message
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Contact;