// src/pages/DocumentationPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Book, Code, FileText, Video, HelpCircle, Download } from 'lucide-react';

const DocumentationPage: React.FC = () => {
    const documentationSections = [
        {
            icon: Book,
            title: "User Guide",
            description: "Complete guide to StuddyHub AI features",
            items: [
                "Getting Started",
                "Note Taking & AI",
                "Recording Lectures",
                "Study Tools"
            ],
            link: "/user-guide-page",
            color: "from-blue-500 to-blue-700"
        },
        {
            icon: Code,
            title: "API Reference",
            description: "Developers & Integration",
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
            icon: HelpCircle,
            title: "Support",
            description: "Get help when you need it",
            items: [
                "FAQs",
                "Contact Support",
                "Troubleshooting",
                "Feedback"
            ],
            link: "/contact",
            color: "from-purple-500 to-purple-700"
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
            answer: "Currently we only support PDF export, but we are working on other formats."
        },
        {
            question: "How do I contact support?",
            answer: "Use our contact form or email studdyhubai@gmail.com. We typically respond within 24 hours."
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

                <div className="grid grid-cols-1 gap-8">
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
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default DocumentationPage;