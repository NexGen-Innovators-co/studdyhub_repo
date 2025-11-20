# StuddyHub

StuddyHub is an advanced note-taking application designed to help users organize, manage, and retrieve their notes efficiently. Built by NexGen-Innovators-co, it combines intuitive user experience with powerful features for productivity and collaboration.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Starting the Application](#starting-the-application)
- [Usage](#usage)
- [Directory Structure](#directory-structure)
  - [Key Directories](#key-directories)
- [Contributing](#contributing)
- [Contact](#contact)

## Features

- **Create, Edit, and Delete Notes:** Users can easily create new notes, modify existing ones, and remove notes that are no longer needed.
- **Organize Notes:** Notes can be organized with tags and folders for better management and retrieval.
- **Powerful Search and Filtering:** Quickly find notes using the search bar and apply filters to narrow down results.
- **Cloud Sync:** Access notes across multiple devices with seamless cloud synchronization.
- **Collaborative Editing:** Share notes with collaborators for joint editing and feedback.
- **Rich Text Formatting:** Enhance notes with rich text formatting and the ability to attach files.
- **Secure Storage:** User data is stored securely with privacy controls to ensure confidentiality.

## Technologies Used

- **React:** A JavaScript library for building user interfaces, enabling the creation of interactive UIs efficiently.
- **TypeScript:** A superset of JavaScript that adds type safety, helping to prevent runtime errors and improving code quality.
- **Vite:** A modern build tool that provides a fast development environment and optimized build process.
- **Node.js:** A JavaScript runtime that allows the execution of JavaScript on the server side.
- **Supabase:** An open-source Firebase alternative that provides backend services like authentication, database, and real-time subscriptions.

## Getting Started

To get a local copy of StuddyHub up and running, follow these steps:

### Prerequisites

Ensure you have the following installed on your machine:

- Node.js (version  or later)
- npm or yarn

### Installation

Clone the repository:

```bash
git clone https://github.com/NexGen-Innovators-co/studdyhub_repo.git
cd StuddyHub
```

Install dependencies:

```bash
npm install
# or
yarn install
```

### Starting the Application

Once the dependencies are installed, you can start the application with the following command:

```bash
npm start
# or
yarn start
```

Open your browser and navigate to [http://localhost:3000](http://localhost:3000) to access the application.

## Usage

- **Creating a Note:** Click the “New Note” button to start a new note.
- **Organizing Notes:** Use tags and folders to categorize your notes for easier access.
- **Searching for Notes:** Utilize the search bar to quickly locate specific notes.
- **Collaborating:** Share notes with others for collaborative editing or export them as needed.

## Directory Structure

The directory structure of the StuddyHub application is organized as follows:

```
StuddyHub/
├── .gitignore
├── README.md
├── api/
│   └── sitemap.js
├── bun.lockb
├── components.json
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public/
│   ├── Sitemap.xml
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   ├── founder.jpg
│   ├── herobackgroundimg.png
│   ├── image.png
│   ├── placeholder.svg
│   ├── robots.txt
│   ├── siteIcon.png
│   ├── siteimage.png
│   ├── testimonial1.jpg
│   ├── testimonial2.jpg
│   ├── testimonial3.jpg
│   ├── user-guid.docx
│   └── videoDemo.mp4
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── components/
│   │   ├── AIChat.tsx
│   │   ├── AISuggestionsPopup.tsx
│   │   ├── AISummarySection.tsx
│   │   ├── AITypingOverlay.tsx
│   │   ├── AudioOptionsSection.tsx
│   │   ├── AudioUploadSection.tsx
│   │   ├── ChatHistory.tsx
│   │   ├── ClassRecordings.tsx
│   │   ├── CodeRenderer.tsx
│   │   ├── ConfirmationModal.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DiagramPanel.tsx
│   │   ├── DocumentSelector.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── DocumentViewerDialog.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Header.tsx
│   │   ├── InlineAIDialog.tsx
│   │   ├── InlineAIEditor.tsx
│   │   ├── InlineAIToolbar.tsx
│   │   ├── UserSettings.tsx
│   │   ├── MarkdownComponent.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── Mermaid.tsx
│   │   ├── MessageList.tsx
│   │   ├── NoteContentArea.tsx
│   │   ├── NoteEditor.tsx
│   │   ├── NoteEditorHeader.tsx
│   │   ├── NotesList.tsx
│   │   ├── QuizHistory.tsx
│   │   ├── QuizModal.tsx
│   │   ├── RecordingDetailsPanel.tsx
│   │   ├── RecordingSidePanel.tsx
│   │   ├── Schedule.tsx
│   │   ├── SectionSelectionDialog.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TabContent.tsx
│   │   ├── TranslatedContentSection.tsx
│   │   ├── TypingAnimation.tsx
│   │   └── VoiceRecorder.tsx
│   ├── constants/
│   │   └── aiSuggestions.ts
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useAppData.tsx
│   │   ├── useAppOperations.tsx
│   │   ├── useAudioProcessing.ts
│   │   ├── useAuth.tsx
│   │   ├── useCopyToClipboard.ts
│   │   ├── useInstantMessage.ts
│   │   ├── useQuizManagement.tsx
│   │   └── useTypingAnimation.ts
│   ├── index.css
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── main.tsx
│   ├── pages/
│   │   ├── APIs.tsx
│   │   ├── AboutUs.tsx
│   │   ├── Auth.tsx
│   │   ├── Blogs.tsx
│   │   ├── Careers.tsx
│   │   ├── ContactUs.tsx
│   │   ├── DocumentationPage.tsx
│   │   ├── Index.tsx
│   │   ├── Integrations.tsx
│   │   ├── LandingPage.tsx
│   │   ├── NotFound.tsx
│   │   ├── PrivacyPolicy.tsx
│   │   ├── TermsOfServices.tsx
│   │   └── UserGuide.tsx
│   ├── services/
│   │   └── aiServices.ts
│   ├── types/
│   │   ├── Class.ts
│   │   ├── Document.ts
│   │   ├── Note.ts
│   │   └── index.ts
│   └── utils/
│       ├── codeHighlighting.ts
│       ├── helpers.ts
│       ├── messageUtils.ts
│       ├── syntaxHighlighting.ts
│       └── textareaUtils.ts
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── analyze-document-structure/
│       │   └── index.ts
│       ├── document-extractor/
│       │   └── index.ts
│       ├── gemini-audio-processor/
│       │   └── index.ts
│       ├── gemini-chat/
│       │   └── index.ts
│       ├── gemini-document-extractor/
│       │   └── index.ts
│       ├── generate-image-from-text/
│       │   └── index.ts
│       ├── generate-note-from-document/
│       │   └── index.ts
│       ├── generate-quiz/
│       │   └── index.ts
│       ├── generate-summary/
│       │   └── index.ts
│       └── image-analyzer/
│           └── index.tsx
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts
```

### Key Directories

- **api/**: Contains server-side code for handling API requests, including the sitemap generation.
- **public/**: Holds static assets such as images, icons, and documentation files.
- **src/**: The main source directory containing the application code, including components, pages, hooks, services, and utilities.
- **supabase/**: Contains configuration and serverless functions for backend services and database migrations.

## Contributing

We welcome contributions to StuddyHub! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them.
4. Push your changes to your forked repository.
5. Open a pull request with a description of your changes.

## Contact

For questions or feedback, please open an issue in the GitHub repository or reach out to the maintainers.

---

_Made by NexGen-Innovators-co_
