// src/pages/TermsOfService.tsx
import React from 'react';
import { AppLayout, ContentContainer, Card, ThemedImg } from '../components/layout/LayoutComponents';

const TermsOfService: React.FC = () => {
    const sections = [
        {
            title: "Acceptance of Terms",
            content: "By accessing or using StuddyHub AI, you agree to be bound by these Terms of Service. If you disagree with any part, you may not access the service."
        },
        {
            title: "User Accounts",
            content: "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities under your account. Accounts are personal and may not be shared."
        },
        {
            title: "Intellectual Property",
            content: "The service and its original content, features, and functionality are owned by StuddyHub AI and are protected by international copyright, trademark, and other laws."
        },
        {
            title: "User Content",
            content: "You retain ownership of any content you submit (notes, documents, recordings). You grant us a limited licence to process this content solely for the purpose of providing our services, including AI analysis."
        },
        {
            title: "AI-Generated Content",
            content: "Summaries, quiz questions, podcast scripts, and other AI-generated outputs are provided as study aids. They may contain inaccuracies. You are responsible for verifying AI outputs before relying on them for academic work."
        },
        {
            title: "Recordings & Podcasts",
            content: "You may only record lectures or conversations where you have obtained consent from all participants. Uploaded audio is processed by AI for transcription and captioning. You are solely responsible for the legality of any recording."
        },
        {
            title: "Acceptable Use",
            content: "You agree not to use the service for any illegal purpose, to upload harmful content, to attempt to circumvent content moderation, or to infringe upon the rights of others."
        },
        {
            title: "Termination",
            content: "We may suspend or terminate your account for breach of these Terms, abuse of the platform, or at our discretion with reasonable notice. You may delete your account at any time from Settings."
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/dashboard-light.jpg" alt="Terms of Service" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-gray-300 text-sm font-semibold tracking-widest uppercase mb-3">Legal Agreement</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Terms of Service</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Last updated: February 1, 2026. Please read these terms carefully before using our services.
                        </p>
                    </div>
                </div>

                <div className="mb-12">
                    <Card className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Important Legal Agreement</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                            These Terms of Service govern your use of StuddyHub AI. By using our service,
                            you agree to these terms in full.
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            This is a legally binding agreement. Please read carefully.
                        </p>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {sections.map((section, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-3">{section.title}</h3>
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

                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Subscription & Billing</h4>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Free-tier users may use core features at no charge. Premium features require an active subscription.
                                    Subscription fees are billed in advance and are non-refundable except where required by law.
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
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h4>
                                    <p className="text-gray-600 dark:text-gray-400">studdyhubai@gmail.com</p>
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
                                    <p className="text-gray-600 dark:text-gray-400">+233 24 169 2568</p>
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