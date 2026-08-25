# 🤝 Contributing to StuddyHub

Thank you for your interest in contributing to StuddyHub! This guide will help you get started with contributing to our AI-powered learning platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We pledge to:

- ✅ Be respectful and considerate
- ✅ Welcome diverse perspectives
- ✅ Accept constructive criticism gracefully
- ✅ Focus on what's best for the community
- ✅ Show empathy towards others

### Unacceptable Behavior

- ❌ Harassment or discrimination
- ❌ Trolling or insulting comments
- ❌ Personal or political attacks
- ❌ Publishing others' private information
- ❌ Any conduct that would be inappropriate professionally

### Enforcement

Violations of the Code of Conduct may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report violations to: conduct@studdyhub.com

---

## Getting Started

### Prerequisites

Before you begin, make sure you have:

- Node.js 18.x or higher
- npm, yarn, or bun
- Git
- A code editor (VS Code recommended)
- Supabase CLI (for backend development)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/studdyhub_repo.git
   cd studdyhub_repo
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original/studdyhub_repo.git
   ```

### Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Set up Supabase locally**:
   ```bash
   npx supabase start
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**: http://localhost:5173

---

## Development Workflow

### 1. Pick an Issue

- Browse [open issues](https://github.com/yourusername/studdyhub_repo/issues)
- Look for labels:
  - `good first issue` - Great for beginners
  - `help wanted` - We need help with this
  - `bug` - Something isn't working
  - `enhancement` - New feature or request
  - `documentation` - Improvements to docs

### 2. Create a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/amazing-feature
# or for bugs
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

Examples:
- `feature/add-flashcards`
- `fix/recording-duration-bug`
- `docs/update-api-reference`
- `refactor/improve-note-editor`

### 3. Make Changes

- Write clean, readable code
- Follow our coding standards
- Add tests for new features
- Update documentation
- Test thoroughly

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add flashcard generation feature"
```

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push to Your Fork

```bash
git push origin feature/amazing-feature
```

### 6. Create Pull Request

- Go to your fork on GitHub
- Click "New Pull Request"
- Fill in the PR template
- Link related issues
- Request reviews

---

## Coding Standards

### TypeScript

#### Use TypeScript Strictly

```typescript
// ✅ Good
interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

function createNote(data: Partial<Note>): Promise<Note> {
  // implementation
}

// ❌ Bad
function createNote(data: any): any {
  // implementation
}
```

#### Define Clear Types

```typescript
// ✅ Good - Explicit types
type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading';

interface UserPreferences {
  learningStyle: LearningStyle;
  explanationStyle: 'simple' | 'detailed' | 'comprehensive';
  examples: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// ❌ Bad - String types
interface UserPreferences {
  learningStyle: string;
  explanationStyle: string;
  examples: boolean;
  difficulty: string;
}
```

### React Components

#### Functional Components with TypeScript

```typescript
// ✅ Good
interface NoteCardProps {
  note: Note;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  return (
    <div className="note-card">
      <h3>{note.title}</h3>
      <p>{note.content}</p>
    </div>
  );
}

// ❌ Bad - No types
export function NoteCard({ note, onEdit, onDelete }) {
  // implementation
}
```

#### Use Custom Hooks

```typescript
// ✅ Good - Extract logic to hooks
function NoteEditor() {
  const { note, updateNote, loading } = useNote(noteId);
  const { canEdit } = useFeatureAccess();
  
  if (!canEdit) return <UpgradePrompt />;
  
  return <Editor content={note.content} onChange={updateNote} />;
}

// ❌ Bad - All logic in component
function NoteEditor() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(false);
  // ... lots of logic
}
```

### Naming Conventions

```typescript
// Components - PascalCase
export function NoteEditor() {}
export function UserProfile() {}

// Hooks - camelCase with 'use' prefix
export function useAuth() {}
export function useSubscription() {}

// Constants - UPPER_SNAKE_CASE
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const API_TIMEOUT = 30000;

// Functions - camelCase
export function createNote() {}
export function deleteDocument() {}

// Types/Interfaces - PascalCase
export interface User {}
export type NoteStatus = 'draft' | 'published';
```

### File Organization

```
src/
├── components/
│   └── notes/
│       ├── NoteEditor.tsx         # Component
│       ├── NoteEditor.test.tsx    # Tests
│       ├── NoteList.tsx
│       └── index.ts               # Exports
│
├── hooks/
│   ├── useAuth.tsx
│   ├── useAuth.test.tsx
│   └── index.ts
│
└── types/
    └── Note.ts
```

### Code Style

#### Use ESLint and Prettier

```bash
# Run linter
npm run lint

# Auto-fix issues
npm run lint -- --fix

# Format code
npm run format
```

#### Import Order

```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal dependencies
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 3. Relative imports
import { NoteCard } from './NoteCard';
import { formatDate } from '../utils';

// 4. Types
import type { Note } from '@/types';

// 5. Styles (if any)
import './styles.css';
```

#### Component Structure

```typescript
import React from 'react';
import type { ComponentProps } from './types';

// 1. Types/Interfaces
interface MyComponentProps {
  title: string;
  onSave: () => void;
}

// 2. Component
export function MyComponent({ title, onSave }: MyComponentProps) {
  // 2a. Hooks (in order: useState, useEffect, custom hooks)
  const [value, setValue] = useState('');
  const { user } = useAuth();
  
  useEffect(() => {
    // effect logic
  }, []);
  
  // 2b. Event handlers
  const handleClick = () => {
    // handler logic
  };
  
  // 2c. Computed values
  const isValid = value.length > 0;
  
  // 2d. Early returns
  if (!user) return <LoginPrompt />;
  
  // 2e. Render
  return (
    <div>
      <h1>{title}</h1>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button onClick={handleClick} disabled={!isValid}>
        Save
      </button>
    </div>
  );
}
```

### Error Handling

```typescript
// ✅ Good - Proper error handling
async function fetchNotes() {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*');
    
    if (error) {
      console.error('Failed to fetch notes:', error);
      toast.error('Could not load notes. Please try again.');
      return [];
    }
    
    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    toast.error('An unexpected error occurred.');
    return [];
  }
}

// ❌ Bad - Silent failures
async function fetchNotes() {
  const { data } = await supabase.from('notes').select('*');
  return data || [];
}
```

### Accessibility

```typescript
// ✅ Good - Accessible
<button
  onClick={handleClick}
  aria-label="Delete note"
  disabled={loading}
>
  <TrashIcon aria-hidden="true" />
</button>

// ❌ Bad - Not accessible
<div onClick={handleClick}>
  <TrashIcon />
</div>
```

---

## Commit Guidelines

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes
- `build` - Build system changes

### Examples

```bash
# Feature
git commit -m "feat(notes): add markdown export functionality"

# Bug fix
git commit -m "fix(recording): correct duration calculation"

# Documentation
git commit -m "docs(api): update authentication examples"

# With body and footer
git commit -m "feat(quiz): add flashcard generation

Add ability to generate flashcards from notes using AI.
Flashcards include front/back and are organized by topic.

Closes #123"
```

### Scope

Use the relevant module:
- `notes`
- `documents`
- `recordings`
- `quiz`
- `social`
- `auth`
- `subscription`
- `ai`
- `admin`

### Writing Good Commit Messages

**Do:**
- Use imperative mood ("add" not "added")
- Be clear and concise
- Explain what and why, not how
- Reference issues when applicable

**Don't:**
- Write vague messages ("fix bug", "update code")
- Include implementation details
- Use past tense

```bash
# ✅ Good
feat(notes): add auto-save functionality
fix(auth): resolve token refresh issue
docs(contributing): add commit guidelines

# ❌ Bad
updated stuff
fixed bug
changes
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Tests passing
- [ ] Documentation updated
- [ ] No console warnings/errors
- [ ] Lint checks passing
- [ ] Commits follow convention
- [ ] Branch is up to date with main

### PR Title

Follow same format as commits:

```
feat(notes): add markdown export
fix(recording): correct duration bug
docs(api): update examples
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123
Fixes #456

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests
- [ ] All tests pass locally
```

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least 1 approval required
3. **Testing** - Manual testing if needed
4. **Approval** - Maintainer approves
5. **Merge** - Squash and merge

### Addressing Feedback

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback"
git push origin feature/amazing-feature

# If major rework needed
git commit -m "refactor: restructure based on feedback"
```

---

## Testing Guidelines

### Unit Tests

Test individual components and functions:

```typescript
// NoteEditor.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEditor } from './NoteEditor';

describe('NoteEditor', () => {
  it('renders with initial content', () => {
    render(<NoteEditor content="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
  
  it('calls onChange when content updates', () => {
    const onChange = jest.fn();
    render(<NoteEditor content="" onChange={onChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New text' } });
    
    expect(onChange).toHaveBeenCalledWith('New text');
  });
  
  it('disables editor when loading', () => {
    render(<NoteEditor content="" loading />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

### Integration Tests

Test feature workflows:

```typescript
// createNote.test.ts
describe('Create Note Flow', () => {
  it('creates note and updates UI', async () => {
    // Setup
    const user = await createTestUser();
    
    // Create note
    const note = await createNote({
      userId: user.id,
      title: 'Test Note',
      content: 'Content'
    });
    
    // Verify database
    const { data } = await supabase
      .from('notes')
      .select()
      .eq('id', note.id)
      .single();
    
    expect(data.title).toBe('Test Note');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test NoteEditor.test.tsx

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Test Coverage Goals

- Components: 80%
- Hooks: 90%
- Services: 85%
- Utils: 95%

---

## Documentation

### Code Comments

```typescript
/**
 * Creates a new note for the user.
 * 
 * @param data - Partial note data
 * @param userId - User's ID
 * @returns Created note with ID
 * @throws {Error} If user has reached note limit
 * 
 * @example
 * ```typescript
 * const note = await createNote({
 *   title: 'My Note',
 *   content: 'Note content'
 * }, user.id);
 * ```
 */
export async function createNote(
  data: Partial<Note>,
  userId: string
): Promise<Note> {
  // Check limits
  const canCreate = await checkNoteLimit(userId);
  if (!canCreate) {
    throw new Error('Note limit reached');
  }
  
  // Create note
  const { data: note, error } = await supabase
    .from('notes')
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  
  if (error) throw error;
  return note;
}
```

### README Updates

When adding features, update:
- Main README.md
- Relevant docs in /docs folder
- CHANGELOG.md

### API Documentation

Document all edge functions in API_REFERENCE.md:

```markdown
### Function Name

Brief description.

**Endpoint**: `POST /function-name`

**Request Body**:
\`\`\`json
{
  "param": "value"
}
\`\`\`

**Response**:
\`\`\`json
{
  "result": "value"
}
\`\`\`

**Example**:
\`\`\`typescript
const { data } = await supabase.functions.invoke('function-name', {
  body: { param: 'value' }
});
\`\`\`
```

---

## Community

### Getting Help

- 💬 **Discord**: [Join our server](https://discord.gg/studdyhub)
- 📧 **Email**: dev@studdyhub.com
- 📚 **Docs**: [Documentation](docs/)
- ❓ **GitHub Discussions**: Ask questions

### Contributing Beyond Code

Not a developer? You can still contribute:

- 📝 **Documentation** - Improve guides and examples
- 🐛 **Bug Reports** - Report issues you find
- 💡 **Feature Requests** - Suggest new features
- 🎨 **Design** - UI/UX improvements
- 🌍 **Translation** - Help with internationalization
- 📣 **Community** - Help others in Discord
- 📹 **Content** - Create tutorials and guides

### Recognition

Contributors are recognized in:
- README.md
- Release notes
- Monthly community highlights
- Annual contributor awards

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm run preview            # Preview production build

# Code Quality
npm run lint               # Run linter
npm run lint -- --fix      # Fix linting issues
npm run format             # Format code
npm run type-check         # Check TypeScript

# Testing
npm test                   # Run tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report

# Database
npx supabase start         # Start local Supabase
npx supabase db push       # Push migrations
npx supabase functions deploy  # Deploy functions
```

### Useful Links

- [Main README](../README.md)
- [Architecture Docs](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Features Docs](FEATURES.md)
- [Deployment Guide](DEPLOYMENT.md)

---

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search GitHub issues/discussions
3. Ask in Discord
4. Open a GitHub discussion
5. Email the team

---

**Thank you for contributing to StuddyHub! Together we're building the future of learning. 🚀**
