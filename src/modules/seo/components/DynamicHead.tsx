// components/seo/DynamicHead.tsx
// components/seo/DynamicHead.tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface DynamicHeadProps {
    pathname: string;
}

const DynamicHead: React.FC<DynamicHeadProps> = ({ pathname }) => {
    const seoData = getSEOData(pathname);
    const canonicalUrl = `https://studdyhub.vercel.app${pathname}`;

    return (
        <Helmet>
            <title>{seoData.title}</title>
            <meta name="description" content={seoData.description} />
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph */}
            <meta property="og:title" content={seoData.title} />
            <meta property="og:description" content={seoData.description} />
            <meta property="og:type" content={seoData.type} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:image" content={seoData.image} />
            <meta property="og:site_name" content="StuddyHub" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={seoData.title} />
            <meta name="twitter:description" content={seoData.description} />
            <meta name="twitter:image" content={seoData.image} />

            {/* Additional Meta */}
            {seoData.keywords && <meta name="keywords" content={seoData.keywords} />}
            <meta name="robots" content={seoData.robots} />

            {/* Structured Data */}
            {'structuredData' in seoData && seoData.structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(seoData.structuredData)}
                </script>
            )}
        </Helmet>
    );
};

function getSEOData(pathname: string) {
    // Default data
    const defaultData = {
        title: 'StuddyHub - AI-Powered Social Learning Platform',
        description: 'Join StuddyHub for AI-powered note organization and social learning features. Connect with students, share knowledge, and study smarter together.',
        type: 'website' as const,
        image: 'https://studdyhub.vercel.app/og-default.png',
        robots: 'index, follow',
        keywords: 'notes, AI summary, student organization, study tools, note management, social learning, collaboration',
    };

    // Extract dynamic parts from pathname
    const pathParts = pathname.split('/').filter(Boolean);

    // Handle social routes
    if (pathname.startsWith('/social/post/')) {
        const postId = pathParts[2];
        return {
            title: `Study Post | StuddyHub`,
            description: 'Student-shared study notes and insights on StuddyHub social learning platform.',
            type: 'article' as const,
            image: `https://studdyhub.vercel.app/api/og/post?title=Study+Post`,
            robots: 'index, follow',
            keywords: 'study notes, student collaboration, learning community',
            structuredData: {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Study Post on StuddyHub",
                "description": "Student-shared study notes and insights",
                "url": `https://studdyhub.vercel.app${pathname}`,
                "author": {
                    "@type": "Person",
                    "name": "StuddyHub User"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "StuddyHub",
                    "logo": "https://studdyhub.vercel.app/logo.png"
                }
            }
        };
    }

    if (pathname.startsWith('/social/profile/')) {
        const username = pathParts[2];
        return {
            title: `${username}'s Profile | StuddyHub`,
            description: `${username}'s student profile on StuddyHub social learning platform. Connect and collaborate on study materials.`,
            type: 'profile' as const,
            image: `https://studdyhub.vercel.app/api/og/profile?username=${username}`,
            robots: 'index, follow',
            keywords: `student profile, ${username}, study partner`,
            structuredData: {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": username,
                "url": `https://studdyhub.vercel.app${pathname}`,
                "description": "Student profile on StuddyHub learning platform"
            }
        };
    }

    if (pathname.startsWith('/social/group/')) {
        const groupId = pathParts[2];
        return {
            title: `Study Group | StuddyHub`,
            description: 'Collaborative study group for students on StuddyHub. Share notes, discuss topics, and learn together.',
            type: 'website' as const,
            image: `https://studdyhub.vercel.app/api/og/group?title=Study+Group`,
            robots: 'index, follow',
            keywords: 'study group, collaborative learning, group study',
            structuredData: {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Study Group",
                "description": "Collaborative study group on StuddyHub",
                "url": `https://studdyhub.vercel.app${pathname}`
            }
        };
    }

    // Handle app routes
    switch (pathname) {
        case '/':
            return {
                ...defaultData,
                title: 'StuddyHub - AI-Powered Social Learning Platform for Students',
                structuredData: {
                    "@context": "https://schema.org",
                    "@type": "WebApplication",
                    "name": "StuddyHub",
                    "url": "https://studdyhub.vercel.app",
                    "description": defaultData.description,
                    "applicationCategory": "EducationalApplication",
                    "operatingSystem": "Web Browser",
                    "features": [
                        "AI-powered note organization",
                        "Social learning network",
                        "Study group collaboration",
                        "Document management",
                        "Schedule planning",
                        "Voice recordings",
                        "AI Chatbot assistance"
                    ]
                }
            };

        case '/dashboard':
            return {
                ...defaultData,
                title: 'Dashboard | StuddyHub',
                description: 'Your personalized study dashboard with AI-powered insights and progress tracking.',
                image: 'https://studdyhub.vercel.app/og-dashboard.png',
                robots: 'noindex, follow', // Dashboard is user-specific
            };

        case '/notes':
            return {
                ...defaultData,
                title: 'Smart Notes | StuddyHub',
                description: 'Create, organize, and summarize your study notes with AI assistance on StuddyHub.',
                image: 'https://studdyhub.vercel.app/og-notes.png',
                keywords: 'note taking, AI summarization, study notes, organization',
                robots: 'noindex, follow',
            };

        case '/chat':
            return {
                ...defaultData,
                title: 'AI Study Assistant | StuddyHub',
                description: 'Get instant help with your studies from our AI assistant. Ask questions, get explanations, and learn faster.',
                image: 'https://studdyhub.vercel.app/og-chat.png',
                keywords: 'AI assistant, study help, homework help, learning assistant',
                robots: 'noindex, follow',
            };

        case '/social':
            return {
                ...defaultData,
                title: 'Social Learning Network | StuddyHub',
                description: 'Connect with other students, share study notes, join groups, and collaborate on StuddyHub social learning platform.',
                image: 'https://studdyhub.vercel.app/og-social.png',
                keywords: 'social learning, student network, study groups, collaboration',
                robots: 'index, follow',
            };

        case '/recordings':
            return {
                ...defaultData,
                title: 'Class Recordings | StuddyHub',
                description: 'Record, transcribe, and summarize your lectures with AI. Turn audio into organized notes automatically.',
                image: 'https://studdyhub.vercel.app/og-recordings.png',
                keywords: 'lecture recordings, audio transcription, voice notes, study audio',
                robots: 'noindex, follow',
            };

        case '/about-us':
            return {
                ...defaultData,
                title: 'About Us | StuddyHub',
                description: 'Learn about StuddyHub - the AI-powered social learning platform designed for students.',
                type: 'article' as const,
                robots: 'index, follow',
            };

        case '/blogs':
            return {
                ...defaultData,
                title: 'Blog | StuddyHub',
                description: 'Read articles and tips about effective studying, AI in education, and student productivity.',
                type: 'article' as const,
                image: 'https://studdyhub.vercel.app/og-blog.png',
                robots: 'index, follow',
            };

        case '/privacy-policy':
            return {
                ...defaultData,
                title: 'Privacy Policy | StuddyHub',
                description: 'Read our privacy policy to understand how we protect your data on StuddyHub.',
                robots: 'index, follow',
            };

        case '/terms-of-service':
            return {
                ...defaultData,
                title: 'Terms of Service | StuddyHub',
                description: 'Terms and conditions for using StuddyHub platform.',
                robots: 'index, follow',
            };

        default:
            // For other authenticated routes, use noindex
            if (pathname.startsWith('/')) {
                return {
                    ...defaultData,
                    title: 'StuddyHub - Social Learning Platform',
                    robots: 'noindex, follow',
                };
            }
            return defaultData;
    }
}

export default DynamicHead;