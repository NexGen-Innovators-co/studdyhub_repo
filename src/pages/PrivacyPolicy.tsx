// src/pages/PrivacyPolicy.tsx
import React from 'react';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Shield, Lock, Eye, Database, UserCheck, Mail } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
    const sections = [
        {
            icon: Shield,
            title: "Information We Collect",
            points: [
                "Account information (name, email)",
                "Usage data and interaction logs",
                "Uploaded content (notes, documents, recordings)",
                "Technical information (device, browser, IP)"
            ]
        },
        {
            icon: Lock,
            title: "How We Use Your Information",
            points: [
                "To provide and improve our services",
                "To personalize your learning experience",
                "To communicate with you about updates",
                "To ensure platform security and compliance"
            ]
        },
        {
            icon: Eye,
            title: "Data Protection",
            points: [
                "Enterprise-grade encryption",
                "Regular security audits",
                "Secure data storage",
                "Access controls and monitoring"
            ]
        },
        {
            icon: UserCheck,
            title: "Your Rights",
            points: [
                "Access your personal data",
                "Request data correction",
                "Request data deletion",
                "Export your data",
                "Object to data processing"
            ]
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Privacy Policy"
                    subtitle="Your Data Protection"
                    description="Last updated: July 30, 2025. Learn how we protect and manage your personal information."
                />

                <div className="mb-12">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Shield className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Our Commitment to Privacy</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    At StuddyHub AI, we take your privacy seriously. This policy outlines how we collect,
                                    use, and protect your personal information.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {sections.map((section, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <section.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{section.title}</h3>
                                </div>
                                <ul className="space-y-2">
                                    {section.points.map((point, idx) => (
                                        <li key={idx} className="text-gray-600 dark:text-gray-400 text-sm flex items-start gap-2">
                                            <span className="text-blue-500 mt-1">•</span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Storage & Security</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Storage Location</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    All data is stored on secure servers with enterprise-grade encryption.
                                    We use industry-leading cloud providers with multiple layers of security.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Retention Period</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    We retain your personal data only for as long as necessary to provide our services
                                    and comply with legal obligations. You can request deletion at any time.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Third-Party Sharing</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    We do not sell your personal information. We only share data with trusted service
                                    providers necessary for our operations, under strict confidentiality agreements.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Mail className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Contact Our Privacy Team</h3>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                If you have questions about this privacy policy or how we handle your data,
                                please contact our privacy team:
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h4>
                                    <p className="text-gray-600 dark:text-gray-400">privacy@studdyhub.ai</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Data Protection Officer</h4>
                                    <p className="text-gray-600 dark:text-gray-400">dpo@studdyhub.ai</p>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Postal Address</h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Privacy Team<br />
                                        StuddyHub AI<br />
                                        University of Mines and Technology<br />
                                        Tarkwa, Ghana
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    We typically respond to privacy inquiries within 48 hours.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default PrivacyPolicy;