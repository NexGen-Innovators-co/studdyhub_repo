// src/pages/TermsOfService.tsx
import React from 'react';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { FileText, Scale, AlertCircle, CheckCircle, Book, Shield } from 'lucide-react';

const TermsOfService: React.FC = () => {
    const sections = [
        {
            icon: Book,
            title: "Acceptance of Terms",
            content: "By accessing or using StuddyHub AI, you agree to be bound by these Terms of Service. If you disagree with any part, you may not access the service."
        },
        {
            icon: Shield,
            title: "User Accounts",
            content: "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities under your account."
        },
        {
            icon: Scale,
            title: "Intellectual Property",
            content: "The service and its original content, features, and functionality are owned by StuddyHub AI and are protected by international copyright, trademark, and other laws."
        },
        {
            icon: AlertCircle,
            title: "User Content",
            content: "You retain ownership of any content you submit, but grant us a license to use, modify, and display it for the purpose of providing our services."
        },
        {
            icon: CheckCircle,
            title: "Acceptable Use",
            content: "You agree not to use the service for any illegal purpose, to violate any laws, or to infringe upon the rights of others."
        },
        {
            icon: FileText,
            title: "Termination",
            content: "We may terminate or suspend your account immediately for any reason, including breach of these Terms, without prior notice or liability."
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Terms of Service"
                    subtitle="Legal Agreement"
                    description="Last updated: July 30, 2025. Please read these terms carefully before using our services."
                />

                <div className="mb-12">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                <FileText className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Important Legal Agreement</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    These Terms of Service govern your use of StuddyHub AI. By using our service,
                                    you agree to these terms in full.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                            <AlertCircle className="h-4 w-4" />
                            <span>This is a legally binding agreement. Please read carefully.</span>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {sections.map((section, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <section.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{section.title}</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {section.content}
                                </p>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Service Modifications</h3>
                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                We reserve the right to modify or discontinue, temporarily or permanently, the service
                                (or any part thereof) with or without notice. We shall not be liable to you or any third
                                party for any modification, suspension, or discontinuance of the service.
                            </p>

                            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Updates to Terms</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    We may update these terms from time to time. We will notify you of any changes by
                                    posting the new Terms of Service on this page and updating the "last updated" date.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Contact Information</h3>

                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                For questions about these Terms of Service, please contact us:
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Legal Department</h4>
                                    <p className="text-gray-600 dark:text-gray-400">legal@studdyhub.ai</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Registered Office</h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        StuddyHub AI<br />
                                        University of Mines and Technology<br />
                                        Tarkwa, Ghana
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Phone</h4>
                                    <p className="text-gray-600 dark:text-gray-400">+233 27 169 2568</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    All legal notices should be sent to the registered office address above.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default TermsOfService;