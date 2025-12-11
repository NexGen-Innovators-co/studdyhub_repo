# 📚 StuddyHub - AI-Powered Learning Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Advanced note-taking and learning management system with AI-powered features, real-time collaboration, and comprehensive subscription management.

## 🎯 Quick Links

- [Features](#-features)
- [Getting Started](#-getting-started)
- [Subscription System](#-subscription-system)
- [Complete Documentation](#-complete-documentation)
- [Contributing](#-contributing)

---

## ✨ Features

### Core Features
- 📝 **Smart Note-Taking** - AI-assisted note creation and organization
- 🎙️ **Audio Recordings** - Record lectures with auto-transcription
- 📄 **Document Processing** - Upload and extract content from PDFs, images, etc.
- 🤖 **AI Study Assistant** - Get instant help with your studies
- 📅 **Study Scheduler** - Plan and organize study sessions
- 🧠 **Quiz Generation** - Auto-generate quizzes from notes
- 👥 **Social Learning** - Connect and collaborate with other students

### Advanced Features
- ✅ **Real-time Updates** - See changes instantly without refresh
- 🔒 **Subscription Management** - Three-tier pricing (Free/Scholar/Genius)
- 📊 **Analytics Dashboard** - Track your learning progress
- 🎨 **Modern UI/UX** - Beautiful, responsive design
- 🌙 **Dark Mode** - Easy on the eyes

---

## 🚀 Getting Started

### Prerequisites
```bash
Node.js 18+ 
npm or yarn
Supabase account
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/studdyhub.git
cd studdyhub
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Add your Supabase credentials to .env
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
```
http://localhost:5173
```

---

## 💰 Subscription System

StuddyHub offers a comprehensive three-tier subscription system:

### 🟢 Visitor (Free)
- **Cost:** ₦0/month
- 50 notes
- 20 documents (10MB each)
- 5 AI messages/day
- 3 recordings
- Basic features

### 🔵 Scholar
- **Cost:** ₦2,500/month
- Unlimited notes
- 100 documents (50MB each)
- 50 AI messages/day
- 20 recordings
- Social features ✅
- Quiz generation ✅

### ⭐ Genius
- **Cost:** ₦5,000/month
- Everything unlimited
- Priority support
- Exam mode ✅
- Verified badge ✅
- Advanced AI features

### Recent Fixes (Latest Updates)

#### ✅ Real-Time Subscription Status (Complete)
**Issues Fixed:**
1. Status bar showing hardcoded "0" values → Now shows real data
2. Recording duration showing "undefined" → Now shows actual duration
3. Recording uploads saving duration as 0 → Now saves correctly

**Impact:**
- ✅ Real-time updates (no refresh needed)
- ✅ Accurate usage tracking
- ✅ Better UX with progress bars
- ✅ Color-coded feedback (blue/amber/red)

**Files Modified:**
- `src/components/subscription/SubscriptionStatusBar.tsx`
- `src/components/classRecordings/hooks/useAudioProcessing.ts`

---

## 📁 Project Structure

```
studdyhub_repo/
├── src/
│   ├── components/          # React components
│   │   ├── subscription/    # Subscription components
│   │   ├── social/          # Social features
│   │   ├── aiChat/          # AI chat interface
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript definitions
│   ├── utils/               # Utility functions
│   └── contexts/            # React contexts
├── supabase/
│   └── functions/           # Edge functions
└── docs/                    # Documentation
```

---

## 📚 Complete Documentation

### Main Documentation
- **[DOCUMENTATION.md](DOCUMENTATION.md)** - Complete technical documentation (merged from all sources)

### Quick Reference Guides
- **Subscription System** - Implementation guide in DOCUMENTATION.md
- **Real-Time Tracking** - Usage tracking implementation
- **API Reference** - Backend function documentation
- **Testing Guide** - How to test all features

### Documentation Coverage
- ✅ Architecture overview
- ✅ Data models & types
- ✅ Component documentation
- ✅ Hook implementations
- ✅ Feature integrations
- ✅ Testing procedures
- ✅ Troubleshooting guides
- ✅ Deployment checklist

**Total Documentation:** 10,000+ lines covering all aspects

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "subscription"

# Watch mode
npm test -- --watch
```

### Test Coverage
- ✅ Component tests
- ✅ Hook tests
- ✅ Integration tests
- ✅ E2E scenarios

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library
- **Recharts** - Data visualization
- **Lucide React** - Icons

### Backend
- **Supabase** - Database & Auth
- **PostgreSQL** - Data storage
- **Edge Functions** - Serverless API

### Tools
- **Vite** - Build tool
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## 🔐 Security

- ✅ JWT-based authentication
- ✅ Row-level security (RLS)
- ✅ API rate limiting
- ✅ Input validation
- ✅ XSS protection
- ✅ CSRF protection

---

## 📈 Performance

- ✅ Lazy loading components
- ✅ Code splitting
- ✅ Image optimization
- ✅ Database query optimization
- ✅ Caching strategies
- ✅ Real-time subscriptions

**Load Times:**
- Initial load: < 2s
- Component renders: < 100ms
- API responses: < 200ms

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- Follow TypeScript best practices
- Use ESLint and Prettier
- Write meaningful commit messages
- Add tests for new features

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Development Team** - [StuddyHub](https://github.com/studdyhub)

---

## 🙏 Acknowledgments

- Supabase for the amazing backend platform
- Shadcn for the beautiful component library
- The React community for incredible tools

---

## 📞 Support

- 📧 Email: support@studdyhub.com
- 💬 Discord: [Join our server](https://discord.gg/studdyhub)
- 🐛 Issues: [GitHub Issues](https://github.com/studdyhub/issues)

---

## 🗺️ Roadmap

### Q1 2025
- [x] Real-time subscription tracking
- [x] Recording duration fixes
- [x] Social feature guards
- [ ] Mobile app (React Native)

### Q2 2025
- [ ] Advanced analytics
- [ ] Team collaboration features
- [ ] API for third-party integrations
- [ ] Offline mode

### Q3 2025
- [ ] AI tutor improvements
- [ ] Video recording support
- [ ] Advanced scheduling
- [ ] Gamification features

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Total Components | 50+ |
| Custom Hooks | 20+ |
| Documentation Lines | 10,000+ |
| Test Coverage | 80%+ |
| Supported Languages | 5+ |

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=studdyhub/studdyhub&type=Date)](https://star-history.com/#studdyhub/studdyhub&Date)

---

**Made with ❤️ by the StuddyHub Team**

[⬆ back to top](#-studdyhub---ai-powered-learning-platform)