// src/pages/APIs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, SectionHeading, Card, ThemedImg } from '../components/layout/LayoutComponents';
import { Zap } from 'lucide-react';

const APIPage: React.FC = () => {
    const apiFeatures = [
        {
            title: "AI Chat & Summarisation",
            description: "Send documents or text to our AI and receive structured summaries, key points, or conversational answers.",
            endpoint: "Edge Function — ai-chat",
            img: "/screenshots/chat-light.jpg"
        },
        {
            title: "Document Analysis",
            description: "Upload PDFs, slides, or images. The system extracts text, generates embeddings, and enables semantic search.",
            endpoint: "Edge Function — analyze-document",
            img: "/screenshots/documents-light.jpg"
        },
        {
            title: "Audio Transcription",
            description: "Upload audio recordings and receive time-stamped transcripts with automatic chapter markers.",
            endpoint: "Edge Function — transcribe-caption",
            img: "/screenshots/recordings-light.jpg"
        },
        {
            title: "Content Moderation",
            description: "Automatically scan text and images for policy violations before publishing to groups or podcasts.",
            endpoint: "Edge Function — moderate-content",
            img: "/screenshots/settings-light.jpg"
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/dashboardanalytics-light.jpg" alt="StuddyHub API" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-800/85 to-gray-700/80" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-gray-300 text-sm font-semibold tracking-widest uppercase mb-3">For Developers</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">API Documentation</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Explore StuddyHub AI's backend capabilities powered by Supabase Edge Functions and PostgreSQL.
                        </p>
                    </div>
                </div>

                <div className="mb-12">
                    {/* Architecture overview */}
                    <Card className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Architecture Overview</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            StuddyHub AI is built on Supabase (PostgreSQL + Edge Functions + Realtime + Storage).
                            Our backend logic runs as Deno-based Edge Functions deployed globally.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm font-medium">
                            <Zap className="h-4 w-4" />
                            Public API: <span className="font-normal ml-1">Coming Soon — currently internal only</span>
                        </div>
                    </Card>

                    <SectionHeading title="Core Endpoints" description="Key Edge Functions that power the platform." />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {apiFeatures.map((feature, index) => (
                            <Card key={index} className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden !p-0">
                                <ThemedImg src={feature.img} alt={feature.title} className="w-full h-32 object-cover" />
                                <div className="p-5">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                                        {feature.description}
                                    </p>
                                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-xs text-gray-700 dark:text-gray-300">
                                        {feature.endpoint}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <Card className="border-blue-200 dark:border-blue-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Start Example</h3>
                    <div className="bg-gray-900 text-gray-100 p-5 rounded-xl overflow-x-auto mb-5">
                        <pre className="text-sm leading-relaxed">
                            {`// Example: Invoke a Supabase Edge Function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.functions.invoke(
  'ai-chat',
  {
    body: {
      message: "Summarise this chapter for me",
      documentId: "doc_abc123",
      model: "gpt-4o-mini"
    }
  }
);

console.log(data?.reply);`}
                        </pre>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <span
                            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 cursor-not-allowed text-gray-600 dark:text-gray-300 rounded-lg font-medium opacity-70 text-sm"
                        >
                            Full Docs — Coming Soon
                        </span>
                        <Link
                            to="/contact"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                            Request Early Access
                        </Link>
                    </div>
                </Card>
            </ContentContainer>
        </AppLayout>
    );
};

export default APIPage;