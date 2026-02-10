// src/pages/ContactUs.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, Card, ThemedImg } from '../components/layout/LayoutComponents';
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
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/chat-light.jpg" alt="Contact StuddyHub" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-900/85 via-purple-900/80 to-fuchsia-900/75" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-violet-300 text-sm font-semibold tracking-widest uppercase mb-3">Get in Touch</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Contact Us</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Have a question, feedback, or partnership inquiry? Our team typically responds within 24 hours.
                        </p>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                  {quickLinks.map((q, i) => (
                    <Link key={i} to={q.href}>
                      <Card className="group hover:shadow-md transition-shadow h-full">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{q.label}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{q.desc}</p>
                      </Card>
                    </Link>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Contact Info — 2 cols */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="h-auto">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Contact Information</h2>

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
                                        <p className="text-gray-600 dark:text-gray-400 text-sm">+233 24 169 2568</p>
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
                        </Card>
                    </div>

                    {/* Form — 3 cols */}
                    <div className="lg:col-span-3">
                        <Card>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Send us a Message</h2>

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
                        </Card>
                    </div>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Contact;