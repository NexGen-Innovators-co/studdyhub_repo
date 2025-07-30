import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Sun, Moon, Book, Lightbulb, Zap, FileText, Mic, LayoutDashboard, Calendar, Code, Users, TrendingUp } from 'lucide-react';

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
            <header className="w-full px-6 py-4 flex justify-between items-center z-50 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur-md">
                <Link to="/" className="flex items-center gap-3 group">
                    <img
                        src="/siteimage.png"
                        alt="NoteMind AI Logo"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                    />
                    <span className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">NoteMind AI</span>
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
            <main className="flex-1 container mx-auto px-6 py-12 mt-20 md:mt-24">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-blue-600 dark:text-blue-400 text-center">NoteMind AI: The Full User Guide</h1>
                <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 prose dark:prose-invert max-w-3xl mx-auto">
                    <p>Welcome to NoteMind AI, your intelligent companion designed to transform your academic and professional learning journey. This comprehensive guide will walk you through every feature, helping you maximize your productivity and achieve deeper understanding.</p>

                    <h2>1. Introduction to NoteMind AI</h2>
                    <p>NoteMind AI is an advanced learning and note-taking platform powered by artificial intelligence. It's built to simplify complex information, organize your thoughts, and provide personalized assistance tailored to your unique learning style. Whether you're a student, researcher, or professional, NoteMind AI helps you learn smarter, not harder.</p>

                    <h3>Key Benefits:</h3>
                    <ul>
                        <li><strong>Personalized Learning:</strong> AI adapts to your preferred learning style (visual, auditory, kinesthetic, reading/writing).</li>
                        <li><strong>Intelligent Content Processing:</strong> Automatically summarizes, organizes, and extracts key insights from notes, documents, and recordings.</li>
                        <li><strong>Interactive Visualizations:</strong> Generate dynamic diagrams and 3D scenes directly within your chat for better comprehension.</li>
                        <li><strong>Streamlined Workflow:</strong> Manage notes, recordings, and schedules in one intuitive platform.</li>
                    </ul>

                    <h2>2. Getting Started</h2>
                    <h3>2.1 Account Creation & Login</h3>
                    <ol>
                        <li><strong>Sign Up:</strong> Visit <a href="https://notemind.lovable.app/auth" target="_blank" rel="noopener noreferrer">https://notemind.lovable.app/auth</a> and follow the prompts to create your account. You'll typically need to provide your name, email, and set a password.</li>
                        <li><strong>Login:</strong> Once registered, use your credentials to log in.</li>
                    </ol>

                    <h3>2.2 Navigating the Interface</h3>
                    <p>The NoteMind AI interface is designed to be intuitive. Key areas usually include:</p>
                    <ul>
                        <li><strong>Chat Interface:</strong> Your primary interaction point with the AI assistant.</li>
                        <li><strong>Document/Note Library:</strong> Where your uploaded files and created notes are stored.</li>
                        <li><strong>Settings/Profile:</strong> To manage your account, preferences, and learning style.</li>
                    </ul>

                    <h2>3. Core Features</h2>
                    <h3>3.1 Intelligent Note-Taking</h3>
                    <p>NoteMind AI goes beyond traditional note-taking by leveraging AI to enhance your notes.</p>
                    <ul>
                        <li><strong>Creating Notes:</strong>
                            <ul>
                                <li>You can manually type notes into the platform.</li>
                                <li>Upload existing text documents (<code>.txt</code>, <code>.md</code>, <code>.docx</code>) for AI processing.</li>
                            </ul>
                        </li>
                        <li><strong>Organization:</strong> The AI can help categorize and tag your notes, making them easily searchable and retrievable.</li>
                        <li><strong>Summarization:</strong> Ask the AI to summarize lengthy notes or documents into concise bullet points or a brief overview.
                            <ul>
                                <li><em>Example Prompt:</em> "Summarize the key points from my 'Physics Lecture 1' notes."</li>
                            </ul>
                        </li>
                        <li><strong>Key Insight Extraction:</strong> The AI can identify and extract the most important concepts and facts.
                            <ul>
                                <li><em>Example Prompt:</em> "Extract all the definitions of terms from this document."</li>
                            </ul>
                        </li>
                    </ul>

                    <h3>3.2 Effortless Recording Analysis</h3>
                    <p>Turn your lectures, meetings, and brainstorming sessions into searchable, actionable insights.</p>
                    <ul>
                        <li><strong>Voice Recording:</strong> Use the in-app voice recording feature (if available) or upload audio files (<code>.mp3</code>, <code>.wav</code>).</li>
                        <li><strong>Transcription:</strong> The AI will automatically transcribe your audio into text.</li>
                        <li><strong>AI Analysis:</strong> Once transcribed, you can ask the AI to:
                            <ul>
                                <li>Summarize the recording.</li>
                                <li>Identify key speakers (if enabled and clear audio).</li>
                                <li>Extract action items or important decisions.</li>
                                <li><em>Example Prompt:</em> "Summarize the main arguments from this meeting transcript."</li>
                            </ul>
                        </li>
                    </ul>

                    <h3>3.3 Contextual AI Chat</h3>
                    <p>Your AI assistant is more than just a chatbot; it's a personalized learning companion.</p>
                    <ul>
                        <li><strong>Natural Conversation:</strong> Ask questions, seek explanations, or brainstorm ideas in a conversational style.</li>
                        <li><strong>Contextual Understanding:</strong> The AI leverages your uploaded notes and documents to provide highly relevant and personalized responses.</li>
                        <li><strong>Adaptive Responses:</strong> Based on your chosen learning style, the AI will adjust its explanations (e.g., more visual cues for visual learners, more practical steps for kinesthetic learners).</li>
                        <li><strong>Clarifying Questions:</strong> The AI may ask follow-up questions to better understand your needs.</li>
                        <li><em>Example Prompt:</em> "Explain the concept of quantum entanglement, and relate it to the 'Quantum Physics 101' document I uploaded."</li>
                    </ul>

                    <h3>3.4 Smart Document Insights</h3>
                    <p>Upload various document types and let NoteMind AI unlock their full potential.</p>
                    <ul>
                        <li><strong>Supported Formats:</strong> Upload images (<code>.jpeg</code>, <code>.png</code>, <code>.gif</code>, etc.), PDFs, and text-based documents.</li>
                        <li><strong>Content Extraction:</strong> For PDFs and images, the AI attempts to extract all readable text content.</li>
                        <li><strong>Analysis & Search:</strong> Once processed, you can:
                            <ul>
                                <li>Ask questions about the document's content.</li>
                                <li>Request summaries or key takeaways.</li>
                                <li>Search for specific information within your uploaded library.</li>
                                <li><em>Example Prompt:</em> "What are the main causes of climate change discussed in the 'Environmental Science Report.pdf'?"</li>
                            </ul>
                        </li>
                    </ul>

                    <h3>3.5 Personalized Learning Paths</h3>
                    <p>NoteMind AI adapts to how you learn best. You can set your preferred learning style in your profile or explicitly ask the AI to adjust.</p>
                    <ul>
                        <li><strong>Visual Learner:</strong> Expect more diagrams, charts, and descriptions that create mental images.</li>
                        <li><strong>Auditory Learner:</strong> Responses will be more conversational, with verbal cues and narrative explanations.</li>
                        <li><strong>Kinesthetic Learner:</strong> Look for practical steps, real-world applications, and suggestions for interactive exercises or projects.</li>
                        <li><strong>Reading/Writing Learner:</strong> Receive detailed, comprehensive written explanations and opportunities for written reflection.</li>
                    </ul>

                    <h2>4. Interactive Visualizations</h2>
                    <p>One of NoteMind AI's most powerful features is its ability to generate interactive diagrams and 3D scenes directly in the chat.</p>
                    <ul>
                        <li><strong>How to Request:</strong> Simply ask the AI to visualize a concept using a specific type of diagram.
                            <ul>
                                <li><em>Example Prompt:</em> "Can you draw a flowchart showing the process of photosynthesis using Mermaid syntax?"</li>
                                <li><em>Example Prompt:</em> "Generate a bar chart comparing quarterly sales data for Q1-Q4 with Chart.js."</li>
                                <li><em>Example Prompt:</em> "Show me a 3D model of a simple atom with Three.js."</li>
                            </ul>
                        </li>
                        <li><strong>Supported Visualization Types:</strong>
                            <ul>
                                <li><strong>Mermaid Diagrams:</strong> For flowcharts, sequence diagrams, class diagrams, etc. (e.g., <code>graph TD A --{`>`} B</code>).</li>
                                <li><strong>DOT (Graphviz):</strong> For network diagrams, hierarchical structures, and complex graphs.</li>
                                <li><strong>Chart.js:</strong> For various data visualizations like bar charts, line charts, pie charts. You provide the JSON configuration.</li>
                                <li><strong>Three.js:</strong> For interactive 3D scenes and models. The AI will generate JavaScript code that renders in a dedicated panel.</li>
                            </ul>
                        </li>
                        <li><strong>Interacting with Visualizations:</strong>
                            <ul>
                                <li><strong>Diagram Panel:</strong> When a visualization is generated, it will open in a dedicated "Diagram Panel" on the right side of your screen.</li>
                                <li><strong>Resizing:</strong> You can resize the panel by dragging its left or bottom edges.</li>
                                <li><strong>Viewing Raw Code:</strong> For code-based visualizations (Mermaid, DOT, Chart.js, Three.js), you can toggle to "View Raw Code" to see the underlying code generated by the AI.</li>
                                <li><strong>Downloading:</strong>
                                    <ul>
                                        <li><strong>SVG (Mermaid/DOT):</strong> Download diagrams as scalable vector graphics.</li>
                                        <li><strong>PNG (Chart.js/Three.js):</strong> Download charts or 3D scene screenshots as PNG images.</li>
                                        <li><strong>GLTF (Three.js):</strong> For Three.js scenes, you can download the 3D model in GLTF format for use in other 3D applications.</li>
                                        <li><strong>PDF:</strong> Export the visualization as a PDF document.</li>
                                    </ul>
                                </li>
                                <li><strong>AI Correction:</strong> If a generated diagram has an error, you can use the "Suggest AI Correction" button to ask the AI to fix it.</li>
                            </ul>
                        </li>
                    </ul>

                    <h2>5. Integrations</h2>
                    <p>NoteMind AI is designed to work seamlessly with your existing tools. Check the "Integrations" page on the website for a list of supported services. Common integrations may include:</p>
                    <ul>
                        <li><strong>Cloud Storage:</strong> Google Drive, Dropbox for document syncing.</li>
                        <li><strong>Communication Platforms:</strong> Slack, Microsoft Teams for meeting summaries.</li>
                        <li><strong>Calendar Apps:</strong> Google Calendar, Outlook Calendar for schedule optimization.</li>
                    </ul>

                    <h2>6. Account Management</h2>
                    <p>Access your profile and settings to customize your NoteMind AI experience.</p>
                    <ul>
                        <li><strong>Profile Settings:</strong> Update your name, email, and password.</li>
                        <li><strong>Learning Preferences:</strong> Adjust your preferred learning style and content difficulty.</li>
                        <li><strong>Subscription:</strong> Manage your plan and billing information (if applicable).</li>
                    </ul>

                    <h2>7. Troubleshooting & Support</h2>
                    <p>If you encounter any issues or have questions, here's how to get help:</p>
                    <ul>
                        <li><strong>Check FAQs:</strong> Visit the "Documentation" page for a Frequently Asked Questions section.</li>
                        <li><strong>Contact Support:</strong> Use the "Contact Us" page to send a message to our support team. Provide as much detail as possible about your issue.</li>
                        <li><strong>Report Bugs:</strong> If you suspect a bug, please report it via the contact form with steps to reproduce it.</li>
                    </ul>

                    <h2>8. Tips for Maximizing Your Learning with NoteMind AI</h2>
                    <ul>
                        <li><strong>Be Specific with Prompts:</strong> The more detailed your questions, the better the AI can understand and respond.</li>
                        <li><strong>Upload Relevant Documents:</strong> The AI's contextual understanding improves significantly when you provide relevant notes, articles, or books.</li>
                        <li><strong>Experiment with Visualizations:</strong> Don't hesitate to ask for different types of diagrams or 3D models to see which best clarifies a concept for you.</li>
                        <li><strong>Utilize Learning Styles:</strong> Change your learning style preference in settings or explicitly ask the AI to explain something using a different approach (e.g., "Explain this as if I'm a kinesthetic learner").</li>
                        <li><strong>Review AI Responses Critically:</strong> While powerful, AI is a tool. Always cross-reference information and think critically about the responses.</li>
                        <li><strong>Provide Feedback:</strong> Your feedback helps us improve! If something isn't working or could be better, let us know.</li>
                    </ul>
                    <p>Thank you for choosing NoteMind AI. We're excited to be a part of your learning journey!</p>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-10 px-6 bg-gray-800 dark:bg-black text-gray-300 text-center">
                <div className="max-w-6xl mx-auto">
                    <p>&copy; {new Date().getFullYear()} NoteMind AI. All rights reserved.</p>
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
