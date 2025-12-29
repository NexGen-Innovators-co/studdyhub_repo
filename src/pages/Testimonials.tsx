// src/pages/Testimonials.tsx
import React from 'react';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';

const testimonials = [
  {
    name: 'Jane Doe',
    image: '/public/screenshots/user1.jpg',
    quote: 'StuddyHub AI transformed my study habits! The personalized quizzes and instant feedback made learning fun and effective.',
    role: 'Medical Student'
  },
  {
    name: 'Samuel Lee',
    image: '/public/screenshots/user2.jpg',
    quote: 'The AI-powered notes and class recordings helped me catch up on missed lectures. Highly recommended!',
    role: 'Engineering Undergraduate'
  },
  {
    name: 'Amina Yusuf',
    image: '/public/screenshots/user3.jpg',
    quote: 'I love the immersive experience and the supportive community. StuddyHub is a game-changer for African students.',
    role: 'Law Student'
  }
];

const Testimonials: React.FC = () => (
  <AppLayout>
    <ContentContainer>
      <PageHeader
        title="Testimonials"
        subtitle="Hear from our users"
        description="Real stories from students and professionals who use StuddyHub AI every day."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
        {testimonials.map((t, i) => (
          <Card key={i} className="flex flex-col items-center p-6 bg-white dark:bg-gray-900 shadow-lg rounded-xl transition-transform hover:scale-105">
            <img src={t.image} alt={t.name} className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-blue-200 shadow-md" />
            <blockquote className="italic text-lg text-gray-700 dark:text-gray-300 mb-4 text-center">“{t.quote}”</blockquote>
            <div className="text-blue-700 dark:text-blue-300 font-semibold">{t.name}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">{t.role}</div>
          </Card>
        ))}
      </div>
    </ContentContainer>
  </AppLayout>
);

export default Testimonials;
