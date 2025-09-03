// SlidesRenderer.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface Slide {
    title: string;
    content: string | string[];
    layout?: string;
}

interface SlidesRendererProps {
    slides: Slide[];
    currentSlideIndex: number;
}

export const SlidesRenderer: React.FC<SlidesRendererProps> = ({ slides, currentSlideIndex }) => {
    return (
        slides.length > 0 && currentSlideIndex < slides.length ? (
            <div
                id="current-slide-content"
                className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl overflow-auto"
                style={{ minHeight: '300px' }}
            >
                <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-blue-800 dark:text-blue-300 text-center">
                    {slides[currentSlideIndex].title}
                </h2>
                {Array.isArray(slides[currentSlideIndex].content) ? (
                    <ul className="list-disc list-inside text-lg sm:text-xl space-y-3 px-4 max-w-full overflow-auto">
                        {slides[currentSlideIndex].content.map((item, i) => (
                            <li key={i} className="mb-2">
                                <ReactMarkdown>{item}</ReactMarkdown>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="prose dark:prose-invert text-lg sm:text-xl text-center max-w-full overflow-auto">
                        <ReactMarkdown>{slides[currentSlideIndex].content}</ReactMarkdown>
                    </div>
                )}
            </div>
        ) : (
            <div>No slides available.</div>
        )
    );
};