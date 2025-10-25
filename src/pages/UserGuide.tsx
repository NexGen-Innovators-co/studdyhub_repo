import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'; // Import Card components
import { Sparkles, Sun, Moon, Book, Lightbulb, Zap, FileText, Mic, LayoutDashboard, Calendar, Code, Users, TrendingUp, ChevronRight, ChevronDown, List, ScrollText, Settings, HelpCircle, MessageSquare, Plug } from 'lucide-react';

const UserGuidePage: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = React.useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme === 'dark';
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    const sectionRefs = {
        introduction: useRef<HTMLDivElement>(null),
        gettingStarted: useRef<HTMLDivElement>(null),
        coreFeatures: useRef<HTMLDivElement>(null),
        interactiveVisualizations: useRef<HTMLDivElement>(null),
        integrations: useRef<HTMLDivElement>(null),
        accountManagement: useRef<HTMLDivElement>(null),
        troubleshooting: useRef<HTMLDivElement>(null),
        tips: useRef<HTMLDivElement>(null),
    };

    const scrollToSection = (sectionId: keyof typeof sectionRefs) => {
        sectionRefs[sectionId].current?.scrollIntoView({ behavior: 'smooth' });
    };

    React.useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode);
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans antialiased flex flex-col">
            {/* Header */}
            <header className="w-full px-6 py-4 flex justify-between items-center z-50 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md fixed top-0 left-0 right-0">
                <Link to="/" className="flex items-center gap-3 group">
                    <img
                        src="/siteimage.png"
                        alt="studdyhub AI Logo"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                    />
                    <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">studdyhub AI</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link to="/auth">
                        <Button type="button" className="px-5 py-2 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Sign In</Button>
                    </Link>
                    <Button
                        type="button"
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-6 py-12 mt-20 md:mt-24 flex flex-col lg:flex-row gap-8">
                {/* Sticky Table of Contents */}
                <aside className="lg:w-1/4 lg:sticky lg:top-24 h-fit bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 hidden lg:block">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                        <List className="h-6 w-6 text-blue-600 dark:text-blue-400" /> Table of Contents
                    </h2>
                    <nav>
                        <ul className="space-y-3">
                            <li>
                                <button onClick={() => scrollToSection('introduction')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 1. Introduction
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('gettingStarted')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 2. Getting Started
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('coreFeatures')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 3. Core Features
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('interactiveVisualizations')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 4. Interactive Visualizations
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('integrations')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 5. Integrations
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('accountManagement')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 6. Account Management
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('troubleshooting')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 7. Troubleshooting & Support
                                </button>
                            </li>
                            <li>
                                <button onClick={() => scrollToSection('tips')} className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                                    <ChevronRight className="h-4 w-4" /> 8. Tips for Maximizing Learning
                                </button>
                            </li>
                        </ul>
                    </nav>
                </aside>

                {/* Content Area */}
                <div className="lg:w-3/4 bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-none">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">studdyhub AI: The Full User Guide</h1>
                    <p className="lead text-lg text-gray-700 dark:text-gray-300 mb-10">Welcome to studdyhub AI, your intelligent companion designed to transform your academic and professional learning journey. This comprehensive guide will walk you through every feature, helping you maximize your productivity and achieve deeper understanding.</p>

                    <section ref={sectionRefs.introduction} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" /> 1. Introduction to studdyhub AI
                        </h2>
                        <p>studdyhub AI is an advanced learning and note-taking platform powered by artificial intelligence. It's built to simplify complex information, organize your thoughts, and provide personalized assistance tailored to your unique learning style. Whether you're a student, researcher, or professional, studdyhub AI helps you learn smarter, not harder.</p>

                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Lightbulb className="h-6 w-6 text-yellow-600 dark:text-yellow-400" /> Key Benefits:
                        </h3>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Personalized Learning:</strong> AI adapts to your preferred learning style (visual, auditory, kinesthetic, reading/writing).</li>
                            <li><strong>Intelligent Content Processing:</strong> Automatically summarizes, organizes, and extracts key insights from notes, documents, and recordings.</li>
                            <li><strong>Interactive Visualizations:</strong> Generate dynamic diagrams and 3D scenes directly within your chat for better comprehension.</li>
                            <li><strong>Streamlined Workflow:</strong> Manage notes, recordings, and schedules in one intuitive platform.</li>
                        </ul>
                    </section>

                    <section ref={sectionRefs.gettingStarted} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Users className="h-8 w-8 text-green-600 dark:text-green-400" /> 2. Getting Started
                        </h2>
                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <ChevronRight className="h-5 w-5" /> 2.1 Account Creation & Login
                        </h3>
                        <ol className="list-decimal list-inside space-y-2">
                            <li><strong>Sign Up:</strong> Visit <a href="https://studdyhub.lovable.app/auth" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://studdyhub.lovable.app/auth</a> and follow the prompts to create your account. You'll typically need to provide your name, email, and set a password.</li>
                            <li><strong>Login:</strong> Once registered, use your credentials to log in.</li>
                        </ol>

                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5" /> 2.2 Navigating the Interface
                        </h3>
                        <p>The studdyhub AI interface is designed to be intuitive. Key areas usually include:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Chat Interface:</strong> Your primary interaction point with the AI assistant.</li>
                            <li><strong>Document/Note Library:</strong> Where your uploaded files and created notes are stored.</li>
                            <li><strong>Settings/Profile:</strong> To manage your account, preferences, and learning style.</li>
                        </ul>
                    </section>

                    <section ref={sectionRefs.coreFeatures} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Book className="h-8 w-8 text-blue-600 dark:text-blue-400" /> 3. Core Features
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                        <ScrollText className="h-5 w-5 text-blue-600" /> 3.1 Intelligent Note-Taking
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p>studdyhub AI goes beyond traditional note-taking by leveraging AI to enhance your notes.</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>Creating Notes:</strong> Manually type notes or upload existing text documents (<code>.txt</code>, <code>.md</code>, <code>.docx</code>).</li>
                                        <li><strong>Organization:</strong> AI can categorize and tag your notes for easy retrieval.</li>
                                        <li><strong>Summarization:</strong> Ask the AI to summarize lengthy notes or documents.
                                            <p className="text-sm italic text-gray-600 dark:text-gray-400">Example: "Summarize the key points from my 'Physics Lecture 1' notes."</p>
                                        </li>
                                        <li><strong>Key Insight Extraction:</strong> Identify and extract important concepts and facts.
                                            <p className="text-sm italic text-gray-600 dark:text-gray-400">Example: "Extract all the definitions of terms from this document."</p>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                        <Mic className="h-5 w-5 text-green-600" /> 3.2 Effortless Recording Analysis
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p>Turn your lectures, meetings, and brainstorming sessions into searchable, actionable insights.</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>Voice Recording:</strong> Use in-app recording or upload audio files (<code>.mp3</code>, <code>.wav</code>).</li>
                                        <li><strong>Transcription:</strong> AI automatically transcribes audio into text.</li>
                                        <li><strong>AI Analysis:</strong> Ask AI to summarize, identify speakers, or extract action items.
                                            <p className="text-sm italic text-gray-600 dark:text-gray-400">Example: "Summarize the main arguments from this meeting transcript."</p>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                        <MessageSquare className="h-5 w-5 text-orange-600" /> 3.3 Contextual AI Chat
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p>Your AI assistant is more than just a chatbot; it's a personalized learning companion.</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>Natural Conversation:</strong> Ask questions, seek explanations, or brainstorm ideas.</li>
                                        <li><strong>Contextual Understanding:</strong> AI uses your uploaded content for relevant responses.</li>
                                        <li><strong>Adaptive Responses:</strong> Explanations adjust to your chosen learning style.</li>
                                        <li><strong>Clarifying Questions:</strong> AI may ask follow-up questions for better understanding.
                                            <p className="text-sm italic text-gray-600 dark:text-gray-400">Example: "Explain quantum entanglement, relating it to 'Quantum Physics 101' document."</p>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                        <FileText className="h-5 w-5 text-red-600" /> 3.4 Smart Document Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p>Upload various document types and let studdyhub AI unlock their full potential.</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>Supported Formats:</strong> Images (<code>.jpeg</code>, <code>.png</code>, etc.), PDFs, and text-based documents.</li>
                                        <li><strong>Content Extraction:</strong> AI extracts readable text from PDFs and images.</li>
                                        <li><strong>Analysis & Search:</strong> Ask questions, request summaries, or search within your library.
                                            <p className="text-sm italic text-gray-600 dark:text-gray-400">Example: "What are the main causes of climate change in 'Environmental Science Report.pdf'?"</p>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                        <Lightbulb className="h-5 w-5 text-yellow-600" /> 3.5 Personalized Learning Paths
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p>studdyhub AI adapts to how you learn best. Set your preferred learning style in your profile or explicitly ask the AI to adjust.</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>Visual Learner:</strong> Expect more diagrams, charts, and visual descriptions.</li>
                                        <li><strong>Auditory Learner:</strong> Responses are conversational, with verbal cues.</li>
                                        <li><strong>Kinesthetic Learner:</strong> Look for practical steps, applications, and interactive suggestions.</li>
                                        <li><strong>Reading/Writing Learner:</strong> Receive detailed written explanations and opportunities for written reflection.</li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    <section ref={sectionRefs.interactiveVisualizations} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Code className="h-8 w-8 text-indigo-600 dark:text-indigo-400" /> 4. Interactive Visualizations
                        </h2>
                        <p>One of studdyhub AI's most powerful features is its ability to generate interactive diagrams and 3D scenes directly in the chat.</p>

                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <ChevronRight className="h-5 w-5" /> How to Request:
                        </h3>
                        <p>Simply ask the AI to visualize a concept using a specific type of diagram.</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                            <li><em>Example:</em> "Can you draw a flowchart showing the process of photosynthesis using Mermaid syntax?"</li>
                            <li><em>Example:</em> "Generate a bar chart comparing quarterly sales data for Q1-Q4 with Chart.js."</li>
                            <li><em>Example:</em> "Show me a 3D model of a simple atom with Three.js."</li>
                        </ul>

                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <ChevronRight className="h-5 w-5" /> Supported Visualization Types:
                        </h3>
                        <ul className="list-disc list-inside ml-4 space-y-2">
                            <li><strong>Mermaid Diagrams:</strong> For flowcharts, sequence diagrams, class diagrams, etc. (e.g., <code>graph TD A --{`>`} B</code>).</li>
                            <li><strong>DOT (Graphviz):</strong> For network diagrams, hierarchical structures, and complex graphs.</li>
                            <li><strong>Chart.js:</strong> For various data visualizations like bar charts, line charts, pie charts. You provide the JSON configuration.</li>
                            <li><strong>Three.js:</strong> For interactive 3D scenes and models. The AI will generate JavaScript code that renders in a dedicated panel.</li>
                        </ul>

                        <h3 className="text-2xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <ChevronRight className="h-5 w-5" /> Interacting with Visualizations:
                        </h3>
                        <ul className="list-disc list-inside ml-4 space-y-2">
                            <li><strong>Diagram Panel:</strong> When a visualization is generated, it will open in a dedicated "Diagram Panel" on the right side of your screen.</li>
                            <li><strong>Resizing:</strong> You can resize the panel by dragging its left or bottom edges.</li>
                            <li><strong>Viewing Raw Code:</strong> For code-based visualizations, toggle to "View Raw Code" to see the underlying code.</li>
                            <li><strong>Downloading:</strong>
                                <ul className="list-circle list-inside ml-6 space-y-1">
                                    <li><strong>SVG (Mermaid/DOT):</strong> Download diagrams as scalable vector graphics.</li>
                                    <li><strong>PNG (Chart.js/Three.js):</strong> Download charts or 3D scene screenshots as PNG images.</li>
                                    <li><strong>GLTF (Three.js):</strong> Download 3D models in GLTF format.</li>
                                    <li><strong>PDF:</strong> Export the visualization as a PDF document.</li>
                                </ul>
                            </li>
                            <li><strong>AI Correction:</strong> If a diagram has an error, use "Suggest AI Correction" to ask the AI to fix it.</li>
                        </ul>
                    </section>

                    <section ref={sectionRefs.integrations} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Plug className="h-8 w-8 text-teal-600 dark:text-teal-400" /> 5. Integrations
                        </h2>
                        <p>studdyhub AI is designed to work seamlessly with your existing tools. Check the "Integrations" page on the website for a list of supported services. Common integrations may include:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Cloud Storage:</strong> Google Drive, Dropbox for document syncing.</li>
                            <li><strong>Communication Platforms:</strong> Slack, Microsoft Teams for meeting summaries.</li>
                            <li><strong>Calendar Apps:</strong> Google Calendar, Outlook Calendar for schedule optimization.</li>
                        </ul>
                        <Link to="/integrations">
                            <Button variant="outline" className="mt-4 text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900">
                                View All Integrations
                            </Button>
                        </Link>
                    </section>

                    <section ref={sectionRefs.accountManagement} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <Settings className="h-8 w-8 text-gray-600 dark:text-gray-400" /> 6. Account Management
                        </h2>
                        <p>Access your profile and settings to customize your studdyhub AI experience.</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Profile Settings:</strong> Update your name, email, and password.</li>
                            <li><strong>Learning Preferences:</strong> Adjust your preferred learning style and content difficulty.</li>
                            <li><strong>Subscription:</strong> Manage your plan and billing information (if applicable).</li>
                        </ul>
                        <Link to="/auth">
                            <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                Go to Settings
                            </Button>
                        </Link>
                    </section>

                    <section ref={sectionRefs.troubleshooting} className="mb-10 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <HelpCircle className="h-8 w-8 text-red-600 dark:text-red-400" /> 7. Troubleshooting & Support
                        </h2>
                        <p>If you encounter any issues or have questions, here's how to get help:</p>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Check FAQs:</strong> Visit the <Link to="/documentation" className="text-blue-600 dark:text-blue-400 hover:underline">"Documentation"</Link> page for a Frequently Asked Questions section.</li>
                            <li><strong>Contact Support:</strong> Use the <Link to="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">"Contact Us"</Link> page to send a message to our support team. Provide as much detail as possible about your issue.</li>
                            <li><strong>Report Bugs:</strong> If you suspect a bug, please report it via the contact form with steps to reproduce it.</li>
                        </ul>
                    </section>

                    <section ref={sectionRefs.tips} className="mb-10">
                        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                            <TrendingUp className="h-8 w-8 text-pink-600 dark:text-pink-400" /> 8. Tips for Maximizing Your Learning with studdyhub AI
                        </h2>
                        <ul className="list-disc list-inside space-y-2">
                            <li><strong>Be Specific with Prompts:</strong> The more detailed your questions, the better the AI can understand and respond.</li>
                            <li><strong>Upload Relevant Documents:</strong> The AI's contextual understanding improves significantly when you provide relevant notes, articles, or books.</li>
                            <li><strong>Experiment with Visualizations:</strong> Don't hesitate to ask for different types of diagrams or 3D models to see which best clarifies a concept for you.</li>
                            <li><strong>Utilize Learning Styles:</strong> Change your learning style preference in settings or explicitly ask the AI to explain something using a different approach (e.g., "Explain this as if I'm a kinesthetic learner").</li>
                            <li><strong>Review AI Responses Critically:</strong> While powerful, AI is a tool. Always cross-reference information and think critically about the responses.</li>
                            <li><strong>Provide Feedback:</strong> Your feedback helps us improve! If something isn't working or could be better, let us know.</li>
                        </ul>
                        <p className="mt-8 text-lg text-gray-700 dark:text-gray-300">Thank you for choosing studdyhub AI. We're excited to be a part of your learning journey!</p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-10 px-6 bg-gray-800 dark:bg-black text-gray-300 text-center">
                <div className="max-w-6xl mx-auto">
                    <p>&copy; {new Date().getFullYear()} studdyhub AI. All rights reserved.</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default UserGuidePage;
