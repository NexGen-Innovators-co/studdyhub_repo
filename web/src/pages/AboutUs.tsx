// src/pages/AboutUs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer } from '../modules/layout/components/LayoutComponents';
import { Globe, Award, Play } from 'lucide-react';

const platformFeatures = [
  { label: 'AI Chat', desc: 'Ask questions and get instant explanations on any topic', img: '/screenshots/chat-light.jpg' },
  { label: 'Smart Notes', desc: 'Rich editor with AI summarisation and auto-formatting', img: '/screenshots/notes-light.jpg' },
  { label: 'Document Analysis', desc: 'Upload PDFs or slides and chat with your documents', img: '/screenshots/documents-light.jpg' },
  { label: 'Lecture Recording', desc: 'Record and transcribe audio with automatic captions', img: '/screenshots/recordings-light.jpg' },
  { label: 'Study Podcasts', desc: 'Create and listen to AI-generated study podcasts', img: '/screenshots/social-light.jpg' },
  { label: 'Live Quizzes', desc: 'Compete with classmates in real-time quiz sessions', img: '/screenshots/quizzes-ight.jpg' },
  { label: 'Schedule', desc: 'Plan events with recurring support and reminders', img: '/screenshots/schedules-light.jpg' },
  { label: 'Analytics', desc: 'Track study streaks, progress, and productivity', img: '/screenshots/dashboardanalytics-light.jpg' },
];

const values = [
  { title: 'Student-First', desc: 'Every feature is built around how students actually study.' },
  { title: 'Accessible', desc: 'Quality education tools available to everyone, regardless of location or budget.' },
  { title: 'Private', desc: 'Your study data belongs to you. We never sell personal information.' },
  { title: 'Improving', desc: 'We ship improvements weekly, driven by feedback from our student community.' },
];

const teamMembers = [
  { name: 'Thomas Appiah', role: 'Founder & Lead Engineer', photo: '/founder.jpg' },
  { name: 'Dr. Okai', role: 'Academic Advisor', photo: '/screenshots/team/dr-okai.jpg' },
  { name: 'Isabel Anane', role: 'Product & Design', photo: '/screenshots/team/isabel.jpg' },
  { name: 'Albert', role: 'AI & ML Engineer', photo: '/screenshots/team/albert.jpg' },
];

const AboutUs: React.FC = () => {
  return (
    <AppLayout>
      <ContentContainer>
        {/* Hero */}
        <div className="py-20 mb-16">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4 tracking-wide uppercase">Our Story</p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            About StuddyHub
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
            We build study tools that adapt to how students actually learn — starting from Ghana.
          </p>
        </div>

        {/* What We Do */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-center">
          <div className="relative rounded-lg overflow-hidden">
            <img
              src="/screenshots/dashboard-light.jpg"
              alt="StuddyHub platform"
              className="w-full h-80 object-cover"
            />
            <a
              href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/video_2025-12-06_08-58-44.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
            >
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Play className="h-6 w-6 text-blue-600 ml-0.5" />
              </div>
            </a>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">What We Do</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              StuddyHub is a study platform that brings together notes, documents, recordings, podcasts,
              quizzes, and study groups — all in one place, powered by AI.
            </p>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              We started as a capstone project at the University of Mines and Technology in Tarkwa, Ghana.
              Today, students across multiple universities use StuddyHub to study more effectively.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Globe className="h-4 w-4 text-blue-600" />
                Tarkwa, Ghana
              </span>
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Award className="h-4 w-4 text-blue-600" />
                UMaT Innovation Hub
              </span>
            </div>
          </div>
        </div>

        {/* Platform Features */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">What StuddyHub Does</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">A complete set of study tools, powered by AI.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platformFeatures.map((f, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="h-32 overflow-hidden">
                  <img
                    src={f.img}
                    alt={f.label}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{f.label}</h4>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Our Values</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">The principles behind what we build.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v, i) => (
              <div key={i} className="p-5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{v.title}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Our Team</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">A small team building from Ghana.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {teamMembers.map((m, i) => (
              <div key={i} className="text-center">
                <div className="w-full aspect-square rounded-lg overflow-hidden mb-3 bg-gray-200 dark:bg-gray-700">
                  <img
                    src={m.photo}
                    alt={m.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('flex', 'items-center', 'justify-center');
                        const span = document.createElement('span');
                        span.className = 'text-2xl font-bold text-gray-400';
                        span.textContent = m.name.split(' ').map(n => n[0]).join('');
                        parent.appendChild(span);
                      }
                    }}
                  />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">{m.name}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{m.role}</p>
              </div>
            ))}
          </div>

          {/* Location */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Based at the <strong className="text-gray-900 dark:text-white">Agri-IoT Lab, University of Mines and Technology</strong> in Tarkwa, Ghana.
              Born as a capstone project, now used by students across multiple universities.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/careers"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Join Our Team
              </Link>
              <Link
                to="/contact"
                className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm border border-gray-200 dark:border-gray-600 transition-colors"
              >
                Get in Touch
              </Link>
            </div>
          </div>
        </div>
      </ContentContainer>
    </AppLayout>
  );
};

export default AboutUs;
