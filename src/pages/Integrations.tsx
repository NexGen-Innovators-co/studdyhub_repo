// src/pages/Integrations.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Cloud, MessageSquare, Calendar, FileText, Mic, Zap, CheckCircle, Plug } from 'lucide-react';

const Integrations: React.FC = () => {
    const integrations = [
        {
            category: "Cloud Storage",
            icon: Cloud,
            items: [
                { name: "Google Drive", status: "Available", color: "bg-gradient-to-r from-blue-500 to-blue-600" },
                { name: "Dropbox", status: "Available", color: "bg-gradient-to-r from-blue-400 to-blue-500" },
                { name: "OneDrive", status: "Coming Soon", color: "bg-gradient-to-r from-blue-600 to-blue-700" }
            ]
        },
        {
            category: "Communication",
            icon: MessageSquare,
            items: [
                { name: "Slack", status: "Available", color: "bg-gradient-to-r from-purple-500 to-purple-600" },
                { name: "Microsoft Teams", status: "Available", color: "bg-gradient-to-r from-blue-500 to-blue-600" },
                { name: "Discord", status: "Coming Soon", color: "bg-gradient-to-r from-indigo-500 to-indigo-600" }
            ]
        },
        {
            category: "Productivity",
            icon: Calendar,
            items: [
                { name: "Google Calendar", status: "Available", color: "bg-gradient-to-r from-blue-500 to-blue-600" },
                { name: "Outlook Calendar", status: "Available", color: "bg-gradient-to-r from-blue-600 to-blue-700" },
                { name: "Notion", status: "Available", color: "bg-gradient-to-r from-gray-800 to-black" }
            ]
        },
        {
            category: "Documents",
            icon: FileText,
            items: [
                { name: "Google Docs", status: "Available", color: "bg-gradient-to-r from-blue-500 to-blue-600" },
                { name: "Microsoft Word", status: "Coming Soon", color: "bg-gradient-to-r from-blue-600 to-blue-700" },
                { name: "PDF Tools", status: "Available", color: "bg-gradient-to-r from-red-500 to-red-600" }
            ]
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Integrations"
                    subtitle="Connect Your Tools"
                    description="Seamlessly connect StuddyHub AI with your favorite productivity tools and services."
                />

                <div className="mb-12">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Plug className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Powerful Integration Ecosystem</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Extend StuddyHub AI's capabilities by connecting with your existing workflow tools
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">50+</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Integrations</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">24/7</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Sync</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">99.9%</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Uptime</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">API</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">Access</div>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-8">
                        {integrations.map((category, index) => (
                            <div key={index}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <category.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{category.category}</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {category.items.map((item, idx) => (
                                        <Card key={idx} className="hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.color}`}>
                                                    <span className="text-white font-bold">{item.name.charAt(0)}</span>
                                                </div>
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Available'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                                                    }`}>
                                                    {item.status === 'Available' && <CheckCircle className="h-3 w-3" />}
                                                    {item.status}
                                                </div>
                                            </div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{item.name}</h4>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                                {item.status === 'Available'
                                                    ? 'Ready to connect'
                                                    : 'Coming in next update'}
                                            </p>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Custom Integration</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Need a specific integration that's not listed? Our API makes it easy to build custom connections.
                        </p>
                        <Link to="/api">
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                                Explore API
                            </button>
                        </Link>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Request Integration</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Have a tool you'd like to see integrated? Let us know and we'll prioritize it.
                        </p>
                        <Link to="/contact">
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium">
                                Submit Request
                            </button>
                        </Link>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Integrations;