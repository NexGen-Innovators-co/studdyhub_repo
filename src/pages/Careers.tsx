// src/pages/Careers.tsx
import React from 'react';
import { AppLayout, ContentContainer, SectionHeading, Card, ThemedImg } from '../components/layout/LayoutComponents';
import { Briefcase, MapPin, Clock, ChevronRight } from 'lucide-react';

const Careers: React.FC = () => {
    const jobOpenings = [
        {
            id: 1,
            title: "AI / Machine Learning Engineer",
            department: "Engineering",
            type: "Full-time",
            location: "Remote / Tarkwa, Ghana",
            description: "Build and fine-tune AI models for document analysis, study recommendations, and content moderation.",
            img: "/screenshots/chat-light.jpg"
        },
        {
            id: 2,
            title: "Product Designer (UI/UX)",
            department: "Design",
            type: "Full-time",
            location: "Remote / Tarkwa, Ghana",
            description: "Create intuitive, beautiful interfaces for web and mobile. You'll shape how students interact with AI tools daily.",
            img: "/screenshots/dashboard-light.jpg"
        },
        {
            id: 3,
            title: "Full-Stack Developer (React + Supabase)",
            department: "Engineering",
            type: "Full-time",
            location: "Remote",
            description: "Build features end-to-end across our React/TypeScript frontend and Supabase/PostgreSQL backend.",
            img: "/screenshots/notes-light.jpg"
        },
        {
            id: 4,
            title: "Growth & Community Manager",
            department: "Marketing",
            type: "Full-time",
            location: "Remote",
            description: "Drive user acquisition across African universities, run ambassador programmes, and nurture our student community.",
            img: "/screenshots/social-light.jpg"
        },
        {
            id: 5,
            title: "Educational Content Creator",
            department: "Content",
            type: "Contract / Part-time",
            location: "Remote",
            description: "Produce study guides, blog posts, and podcast episodes that showcase best practices for AI-enhanced learning.",
            img: "/screenshots/recordings-light.jpg"
        },
        {
            id: 6,
            title: "QA & DevOps Engineer",
            department: "Engineering",
            type: "Full-time",
            location: "Remote",
            description: "Ensure platform reliability through testing, CI/CD pipelines, monitoring, and Supabase Edge Function deployments.",
            img: "/screenshots/settings-light.jpg"
        }
    ];

    const benefits = [
        { title: "Competitive Compensation", description: "Fair market-rate salary with potential equity participation", img: "/screenshots/dashboardanalytics-light.jpg" },
        { title: "Remote-First Culture", description: "Work from anywhere — we communicate async-first", img: "/screenshots/chat-light.jpg" },
        { title: "Learning Budget", description: "Annual stipend for courses, books, and conferences", img: "/screenshots/notes-light.jpg" },
        { title: "Ship Real Impact", description: "Your code is used by students every day — small team, big ownership", img: "/screenshots/dashboard-light.jpg" },
        { title: "Modern Stack", description: "React, TypeScript, Supabase, Tailwind, Deno Edge Functions", img: "/screenshots/documents-light.jpg" },
        { title: "Mission-Driven", description: "Help democratise quality education across Africa and beyond", img: "/screenshots/social-light.jpg" }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                {/* Photo-backed hero */}
                <div className="relative rounded-2xl overflow-hidden mb-12">
                    <ThemedImg src="/screenshots/dashboard-light.jpg" alt="StuddyHub careers" className="w-full h-72 md:h-80 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <span className="text-emerald-300 text-sm font-semibold tracking-widest uppercase mb-3">Careers</span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Join Our Team</h1>
                        <p className="text-gray-200 max-w-2xl text-lg">
                            Help us shape the future of AI-powered education. We're looking for passionate individuals to drive our mission forward.
                        </p>
                    </div>
                </div>

                {/* Why Join Us — photo split layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
                    <div className="rounded-2xl overflow-hidden">
                        <ThemedImg src="/screenshots/social-light.jpg" alt="Our collaborative team" className="w-full h-full object-cover min-h-[280px]" />
                    </div>
                    <div className="flex flex-col justify-center">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why Join StuddyHub?</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-4">
                            We're building the future of education, from Ghana to the world. Join a small, high-impact team where your work directly helps students learn better.
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            At StuddyHub, you'll work with cutting-edge AI technology, shape real products used by thousands of students, and grow alongside a team that values creativity, ownership, and impact.
                        </p>
                    </div>
                </div>

                {/* Current Openings */}
                <div className="mb-16">
                    <SectionHeading title="Current Openings" description="Explore roles that match your skills and passion." />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {jobOpenings.map((job) => (
                            <Card key={job.id} className="group hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden !p-0">
                                <ThemedImg src={job.img} alt={job.title} className="w-full h-36 object-cover" />
                                <div className="p-5">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {job.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                                        {job.description}
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                            <Briefcase className="h-4 w-4" />
                                            <span>{job.department}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                            <MapPin className="h-4 w-4" />
                                            <span>{job.location}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                            <Clock className="h-4 w-4" />
                                            <span>{job.type}</span>
                                        </div>
                                    </div>
                                    <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                                        Apply Now
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Perks & Benefits */}
                <div className="mb-16">
                    <SectionHeading title="Perks & Benefits" description="We take care of our team so they can take care of students." />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {benefits.map((benefit, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow overflow-hidden !p-0">
                                <ThemedImg src={benefit.img} alt={benefit.title} className="w-full h-28 object-cover" />
                                <div className="p-5">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">{benefit.description}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Photo-backed CTA */}
                <div className="relative rounded-2xl overflow-hidden">
                    <ThemedImg src="/screenshots/notes-light.jpg" alt="Join StuddyHub" className="w-full h-64 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <h3 className="text-2xl font-bold text-white mb-4">Don't see the perfect role?</h3>
                        <p className="text-gray-200 mb-6 max-w-2xl">
                            We're always looking for talented individuals who are passionate about education technology.
                            Send us your resume and tell us how you can contribute to our mission.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                            <a href="mailto:careers@studdyhub.ai" className="px-6 py-3 bg-white text-blue-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                                Send Your Resume
                            </a>
                            <a href="/contact" className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium backdrop-blur-sm transition-colors">
                                Contact Our Team
                            </a>
                        </div>
                    </div>
                </div>
            </ContentContainer>
        </AppLayout>
    );
};

export default Careers;