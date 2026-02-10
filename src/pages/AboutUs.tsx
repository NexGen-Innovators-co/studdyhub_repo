// src/pages/AboutUs.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AppLayout, ContentContainer, PageHero, SectionHeading, Card, ThemedImg } from '../components/layout/LayoutComponents';
import {
  Sparkles, Users, Lightbulb, Target, Globe, Heart,
  Brain, FileText, Mic, MessageSquare, Calendar, BarChart,
  Shield, Podcast, BookOpen, GraduationCap, Rocket, Award,
  Github, Linkedin, Twitter, Play, Facebook, Instagram
} from 'lucide-react';

const platformFeatures = [
  { label: 'AI Chat Assistant', desc: 'Multi-model AI tutor that adapts to your learning style', img: '/screenshots/chat-light.jpg' },
  { label: 'Smart Notes', desc: 'Rich editor with AI summarisation and auto-formatting', img: '/screenshots/notes-light.jpg' },
  { label: 'Document Analysis', desc: 'Upload PDFs, slides, or images and chat with them', img: '/screenshots/documents-light.jpg' },
  { label: 'Lecture Recording', desc: 'Record, transcribe, and caption audio automatically', img: '/screenshots/recordings-light.jpg' },
  { label: 'Study Podcasts', desc: 'Create, share, and listen to educational podcasts', img: '/screenshots/social-light.jpg' },
  { label: 'Live Quizzes', desc: 'Kahoot-style quiz sessions for interactive learning', img: '/screenshots/quizzes-ight.jpg', imgDark: '/screenshots/quizzes-dark.jpg' },
  { label: 'Schedule & Timetable', desc: 'Plan events with recurring support and reminders', img: '/screenshots/schedules-light.jpg' },
  { label: 'Analytics Dashboard', desc: 'Track study streaks, progress, and productivity', img: '/screenshots/dashboardanalytics-light.jpg' },
];

const values = [
  { title: 'Student-First Design', desc: 'Every feature is built around how students actually study — not how we think they should.', img: '/screenshots/dashboard-light.jpg' },
  { title: 'Accessibility', desc: 'Quality education tools should be available to everyone, regardless of location or budget.', img: '/screenshots/settings-light.jpg' },
  { title: 'Privacy & Trust', desc: 'Your study data belongs to you. We never sell personal information to third parties.', img: '/screenshots/documents-light.jpg' },
  { title: 'Continuous Innovation', desc: 'We ship improvements weekly, driven by real feedback from our student community.', img: '/screenshots/chat-light.jpg' },
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
        {/* Full-width Hero with background image */}
        <div className="relative -mx-4 md:-mx-8 -mt-12 mb-16 overflow-hidden">
          <div className="relative h-[340px] md:h-[420px]">
            {/* Hero background image — replace with your own campus/lab photo */}
            <ThemedImg
              src="/screenshots/dashboard-light.jpg"
              alt="StuddyHub AI campus"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
            <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 rounded-full text-sm font-medium mb-5 tracking-wide uppercase">
                Our Story
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
                About StuddyHub AI
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mt-4 leading-relaxed">
                Transforming education through intelligent technology — one student at a time.
              </p>
            </div>
          </div>
        </div>

        {/* What We Do — photo on left, text on right (reference layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20 items-center">
          {/* Left — photo with video play button overlay */}
          <div className="relative rounded-2xl overflow-hidden shadow-xl group">
            <ThemedImg
              src="/screenshots/dashboard-light.jpg"
              alt="StuddyHub AI platform demo"
              className="w-full h-[360px] object-cover"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
            <a
              href="https://kegsrvnywshxyucgjxml.supabase.co/storage/v1/object/public/documents/video_2025-12-06_08-58-44.mp4"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="h-7 w-7 text-blue-600 ml-1" />
              </div>
            </a>
          </div>

          {/* Right — mission text */}
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6 uppercase">
              What We Do
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg mb-4">
              We build AI-powered study tools that adapt to individual learning styles — making studying more
              personalised, efficient, and accessible for students worldwide, starting from Africa.
            </p>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              From smart notes and document analysis to lecture recordings, podcasts, live quizzes, and
              social study groups — everything a student needs in one place, powered by cutting-edge AI.
            </p>
            {/* Signature-style accent */}
            <div className="text-blue-600 dark:text-blue-400 font-bold text-2xl italic font-serif">
              StuddyHub AI
            </div>
          </div>
        </div>

        {/* Platform Features — photo-based cards */}
        <div className="mb-20">
          <SectionHeading
            title="What StuddyHub AI Does"
            description="A comprehensive suite of AI-enhanced study tools — all in one place."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {platformFeatures.map((f, i) => (
              <div
                key={i}
                className="group rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="h-36 overflow-hidden">
                  <ThemedImg
                    src={f.img}
                    darkSrc={(f as any).imgDark}
                    alt={f.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{f.label}</h4>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Our Values — with small photos */}
        <div className="mb-20">
          <SectionHeading
            title="Our Values"
            description="The principles that guide every decision we make."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <Card key={i} className="overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 !p-0">
                <div className="h-32 overflow-hidden">
                  <ThemedImg src={v.img} alt={v.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">{v.title}</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Our Team — photo grid like the reference design */}
        <div className="mb-16">
          <SectionHeading
            title="Our Team"
            description="A passionate group of AI researchers, educators, and engineers building from Ghana."
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {teamMembers.map((m, i) => (
              <div key={i} className="text-center group">
                {/* Square photo container */}
                <div className="w-full aspect-square rounded-xl overflow-hidden mb-4 shadow-md group-hover:shadow-xl transition-shadow">
                  <img
                    src={m.photo}
                    alt={m.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback: show initials if photo is missing
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-indigo-600', 'flex', 'items-center', 'justify-center');
                        parent.innerHTML = `<span class="text-4xl font-bold text-white">${m.name.split(' ').map(n => n[0]).join('')}</span>`;
                      }
                    }}
                  />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide">{m.name}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 text-blue-600 dark:text-blue-400">{m.role}</p>
                <div className="flex items-center justify-center gap-3 mt-3 text-gray-400 dark:text-gray-500">
                  <a href="#" className="hover:text-blue-600 transition-colors"><Facebook className="h-4 w-4" /></a>
                  <a href="#" className="hover:text-pink-500 transition-colors"><Instagram className="h-4 w-4" /></a>
                  <a href="#" className="hover:text-blue-500 transition-colors"><Twitter className="h-4 w-4" /></a>
                </div>
              </div>
            ))}
          </div>

          {/* Location & CTA */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
                  Based at the <strong className="text-gray-900 dark:text-white">Agri-IoT Lab, University of Mines and Technology</strong> in Tarkwa, Ghana.
                  Born as a capstone project, now used by students across multiple universities.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    <span>Tarkwa, Ghana</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full text-sm font-medium">
                    <Award className="h-4 w-4" />
                    <span>UMaT Innovation Hub</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/careers"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-md hover:shadow-lg"
                >
                  Join Our Team
                </Link>
                <Link
                  to="/contact"
                  className="px-5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </ContentContainer>
    </AppLayout>
  );
};

export default AboutUs;