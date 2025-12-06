// src/pages/APIs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Code, Zap, Shield, Cpu, Database, Terminal } from 'lucide-react';

const APIPage: React.FC = () => {
    const apiFeatures = [
        {
            icon: Cpu,
            title: "Text Summarization",
            description: "Generate concise summaries from long documents and articles",
            endpoint: "POST /api/v1/summarize"
        },
        {
            icon: Database,
            title: "Document Analysis",
            description: "Extract key insights and structured data from various document formats",
            endpoint: "POST /api/v1/analyze"
        },
        {
            icon: Terminal,
            title: "Real-time Transcription",
            description: "Convert audio streams to text with speaker identification",
            endpoint: "POST /api/v1/transcribe"
        },
        {
            icon: Shield,
            title: "Learning Analytics",
            description: "Get personalized insights and recommendations based on user data",
            endpoint: "GET /api/v1/analytics"
        }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="API Documentation"
                    subtitle="Developers & Integration"
                    description="Integrate StuddyHub AI's powerful features directly into your applications with our comprehensive API."
                />

                <div className="mb-12">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Code className="h-6 w-6 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API Overview</h2>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Our RESTful API provides programmatic access to StuddyHub AI's core capabilities.
                            Built with developers in mind, it features comprehensive documentation, sandbox environment,
                            and dedicated support.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                            <Zap className="h-4 w-4" />
                            Base URL: https://api.studdyhub.ai/v1
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {apiFeatures.map((feature, index) => (
                            <Card key={index} className="hover:shadow-xl transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                                    {feature.description}
                                </p>
                                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md font-mono text-xs">
                                    {feature.endpoint}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <Card className="border-blue-200 dark:border-blue-800">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Start Example</h3>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                        <pre className="text-sm">
                            {`// JavaScript Example
const summarizeText = async (text) => {
  const response = await fetch('https://api.studdyhub.ai/v1/summarize', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      max_length: 150
    })
  });
  
  return await response.json();
};`}
                        </pre>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <a
                            href="/api-docs"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                        >
                            View Full Documentation
                        </a>
                        <a
                            href="/contact"
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium"
                        >
                            Get API Key
                        </a>
                    </div>
                </Card>
            </ContentContainer>
        </AppLayout>
    );
};

export default APIPage;