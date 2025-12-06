// components/seo/SocialMetaTags.tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SocialMetaTagsProps {
    title: string;
    description: string;
    type?: 'article' | 'profile' | 'website' | 'group';
    url: string;
    image?: string;
    author?: string;
    publishedTime?: string;
    tags?: string[];
    username?: string;
    groupName?: string;
    followersCount?: number;
    membersCount?: number;
    postCount?: number;
}

export const SocialMetaTags: React.FC<SocialMetaTagsProps> = ({
    title,
    description,
    type = 'website',
    url,
    image = 'https://studdyhub.vercel.app/og-default.png',
    author,
    publishedTime,
    tags = [],
    username,
    groupName,
    followersCount,
    membersCount,
    postCount,
}) => {
    const canonicalUrl = `https://studdyhub.vercel.app${url}`;
    const structuredData = generateStructuredData({
        title,
        description,
        type,
        url: canonicalUrl,
        image,
        author,
        publishedTime,
        tags,
        username,
        groupName,
        followersCount,
        membersCount,
        postCount,
    });

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{`${title} | StuddyHub - Social Learning Platform`}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content="StuddyHub" />

            {type === 'article' && publishedTime && (
                <meta property="article:published_time" content={publishedTime} />
            )}

            {tags.map(tag => (
                <meta key={tag} property="article:tag" content={tag} />
            ))}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:site" content="@studdyhub" />

            {/* Additional Social Meta */}
            {username && <meta property="profile:username" content={username} />}
            {groupName && <meta property="group:name" content={groupName} />}

            {/* Structured Data */}
            <script type="application/ld+json">
                {JSON.stringify(structuredData)}
            </script>

            {/* Additional SEO */}
            <meta name="robots" content="index, follow" />
            <meta name="keywords" content={tags.join(', ')} />
        </Helmet>
    );
};

function generateStructuredData(data: any) {
    const baseData = {
        "@context": "https://schema.org",
        "@type": data.type === 'profile' ? 'Person' :
            data.type === 'group' ? 'Organization' : 'Article',
        "headline": data.title,
        "description": data.description,
        "url": data.url,
        "image": data.image,
        "publisher": {
            "@type": "Organization",
            "name": "StuddyHub",
            "logo": "https://studdyhub.vercel.app/logo.png"
        }
    };

    if (data.type === 'article') {
        return {
            ...baseData,
            "author": {
                "@type": "Person",
                "name": data.author || "StuddyHub User"
            },
            "datePublished": data.publishedTime,
            "keywords": data.tags.join(', ')
        };
    }

    if (data.type === 'profile') {
        return {
            ...baseData,
            "@type": "Person",
            "name": data.title,
            "interactionStatistic": [{
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/FollowAction",
                "userInteractionCount": data.followersCount || 0
            }]
        };
    }

    if (data.type === 'group') {
        return {
            ...baseData,
            "@type": "Organization",
            "memberCount": data.membersCount || 0,
            "numberOfEmployees": data.membersCount || 0
        };
    }

    return baseData;
}