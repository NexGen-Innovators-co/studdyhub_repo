// src/pages/Careers.tsx
import React from 'react';
import { AppLayout, ContentContainer, PageHeader, Card } from '../components/layout/LayoutComponents';
import { Briefcase, Users, Code, Palette, BarChart, Heart, MapPin, Clock, ChevronRight } from 'lucide-react';

const Careers: React.FC = () => {
    const jobOpenings = [
        {
            id: 1,
            title: "Senior AI Engineer",
            department: "Engineering",
            type: "Full-time",
            location: "Remote",
            description: "Develop and implement advanced AI models for personalized learning experiences.",
            icon: Code,
            color: "from-blue-500 to-blue-700"
        },
        {
            id: 2,
            title: "Product Designer (UI/UX)",
            department: "Design",
            type: "Full-time",
            location: "Tarkwa, Ghana",
            description: "Design intuitive and engaging interfaces for our web and mobile applications.",
            icon: Palette,
            color: "from-purple-500 to-purple-700"
        },
        {
            id: 3,
            title: "Frontend Developer (React)",
            department: "Engineering",
            type: "Full-time",
            location: "Remote",
            description: "Build responsive and high-performance user interfaces using modern frameworks.",
            icon: Code,
            color: "from-green-500 to-green-700"
        },
        {
            id: 4,
            title: "Growth Marketing Manager",
            department: "Marketing",
            type: "Full-time",
            location: "Remote",
            description: "Develop and execute strategies to drive user acquisition and engagement.",
            icon: BarChart,
            color: "from-orange-500 to-orange-700"
        },
        {
            id: 5,
            title: "Content Strategist",
            department: "Content",
            type: "Full-time",
            location: "Remote",
            description: "Create engaging educational content and learning materials for our platform.",
            icon: Briefcase,
            color: "from-red-500 to-red-700"
        },
        {
            id: 6,
            title: "Customer Success Manager",
            department: "Support",
            type: "Full-time",
            location: "Remote",
            description: "Ensure customer satisfaction and help users maximize their learning experience.",
            icon: Heart,
            color: "from-pink-500 to-pink-700"
        }
    ];

    const benefits = [
        { icon: "💰", title: "Competitive Salary", description: "Market-rate compensation with equity options" },
        { icon: "🏖️", title: "Flexible Time Off", description: "Unlimited PTO and flexible working hours" },
        { icon: "🏠", title: "Remote Work", description: "Work from anywhere with flexible schedules" },
        { icon: "📚", title: "Learning Budget", description: "Annual budget for courses and conferences" },
        { icon: "🏥", title: "Health Benefits", description: "Comprehensive medical and dental coverage" },
        { icon: "💻", title: "Tech Equipment", description: "Latest hardware and software for your work" }
    ];

    return (
        <AppLayout>
            <ContentContainer>
                <PageHeader
                    title="Join Our Team"
                    subtitle="Careers at StuddyHub AI"
                    description="Help us shape the future of AI-powered education. We're looking for passionate individuals to drive our mission forward."
                />

                <div className="mb-12">
                    <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Users className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Why Join Us?</h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    We're building the future of education from Ghana to the world. Join us in making quality learning accessible to everyone.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Current Openings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {jobOpenings.map((job) => (
                                <Card key={job.id} className="group hover:shadow-xl transition-all hover:-translate-y-1">
                                    <div className={`h-32 ${job.color} rounded-xl mb-4 flex items-center justify-center`}>
                                        <job.icon className="h-12 w-12 text-white" />
                                    </div>

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
                                </Card>
                            ))}
                        </div>
                    </div>

                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Perks & Benefits</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {benefits.map((benefit, index) => (
                                <Card key={index} className="hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-3">{benefit.icon}</div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">{benefit.description}</p>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Don't see the perfect role?
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                            We're always looking for talented individuals who are passionate about education technology.
                            Send us your resume and tell us how you can contribute to our mission.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                            <a
                                href="mailto:careers@studdyhub.ai"
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                            >
                                Send Your Resume
                            </a>
                            <a
                                href="/contact"
                                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium"
                            >
                                Contact Our Team
                            </a>
                        </div>
                    </div>
                </Card>
            </ContentContainer>
        </AppLayout>
    );
};

export default Careers;