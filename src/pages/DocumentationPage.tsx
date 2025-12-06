// src/pages/DocumentationPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Book, Code, FileText, Video, HelpCircle, Download } from 'lucide-react';

const DocumentationPage: React.FC = () => {
    const documentationSections = [
        {
            icon: Book,
            title: "Getting Started",
            description: "Begin your journey with StuddyHub AI",
            items: [
                "Quick Start Guide",
                "Account Setup",
                "Basic Navigation",
                "First Steps Tutorial"
            ],
            link: "/docs/getting-started",
            color: "from-blue-500 to-blue-700"
        },
        {
            icon: Code,
            title: "API Reference",
            description: "Complete API documentation",
            items: [
                "Authentication",
                "Endpoints",
                "Code Examples",
                "Best Practices"
            ],
            link: "/api",
            color: "from-green-500 to-green-700"
        },
        {
            icon: FileText,
            title: "User Guides",
            description: "Step-by-step instructions",
            items: [
                "Note Management",
                "Recording Features",
                "AI Assistant",
                "Learning Tools"
            ],
            link: "/user-guide-page",
            color: "from-purple-500 to-purple-700"
        },
        {
            icon: Video,
            title: "Tutorials",
            description: "Video and interactive guides",
            items: [
                "Video Tutorials",
                "Interactive Demos",
                "Case Studies",
                "Tips & Tricks"
            ],
            link: "/tutorials",
            color: "from-orange-500 to-orange-700"
        }
    ];

    const faqs = [
        {
            question: "How do I reset my password?",
            answer: "Visit the login page and click 'Forgot Password'. Follow the instructions sent to your email."
        },
        {
            question: "Is my data secure?",
            answer: "Yes, we use enterprise-grade encryption and follow strict data protection protocols."
        },
        {
            question: "Can I export my notes and data?",
            answer: "Yes, you can export all your data in multiple formats including PDF, CSV, and Markdown."
        },
        {
            question: "How do I contact support?",
            answer: "Use our contact form or email support@studdyhub.ai. We typically respond within 24 hours."
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Documentation"
                    subtitle="Resources & Guides"
                    description="Everything you need to make the most of StuddyHub AI's features and capabilities."
                />

                <div className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {documentationSections.map((section, index) => (
                            <Link to={section.link} key={index}>
                                <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-1 group">
                                    <div className={`h-32 ${section.color} rounded-xl mb-4 flex items-center justify-center`}>
                                        <section.icon className="h-12 w-12 text-white" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {section.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                                        {section.description}
                                    </p>
                                    <ul className="space-y-1">
                                        {section.items.map((item, idx) => (
                                            <li key={idx} className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-1">
                                                <span className="text-blue-500">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
                        </div>

                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                        {faq.question}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        {faq.answer}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Download className="h-5 w-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Download Resources</h2>
                        </div>

                        <div className="space-y-4">
                            <a
                                href="/docs/user-guide.pdf"
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
                            >
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Complete User Guide</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">PDF • 2.4 MB</p>
                                </div>
                                <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </a>

                            <a
                                href="/docs/api-reference.pdf"
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
                            >
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">API Reference</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">PDF • 1.8 MB</p>
                                </div>
                                <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </a>

                            <a
                                href="/docs/quick-start.pdf"
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-shadow"
                            >
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">Quick Start Guide</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">PDF • 1.2 MB</p>
                                </div>
                                <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </a>
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default DocumentationPage;