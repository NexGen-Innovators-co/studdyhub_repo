# StuddyHub Product Workspace Roadmap

Last updated: 2026-10-19

## Purpose

This document is the handoff for the StuddyHub UI simplification work inspired by Google NotebookLM. It records the current destination, completed changes, constraints, and the next implementation slice so another agent can continue without reconstructing the history.

## Product Destination

StuddyHub should feel like a focused study workspace rather than a feature catalog.

Primary user mental model:

- A **Notebook** is a focused study workspace.
- A **Source** is a document, note, recording, webpage, or uploaded file.
- **Chat** asks questions about selected sources.
- **Study tools** create flashcards, quizzes, summaries, podcasts, and visual explanations.
- **Analytics** is a secondary report area, not the home screen.

The home screen should help a user start working immediately:

1. Create or open a notebook.
2. Add a source.
3. Ask questions or use a study tool.
4. Return to recent work.

## Completed Work

### Dashboard

The dashboard was reshaped into a material-first workspace in:

- `web/src/modules/dashboard/components/Dashboard.tsx`

Current dashboard behavior:

- Shows a large `New notebook` action.
- Shows source actions for upload, note, recording, and quiz.
- Shows recent study material cards.
- Ends after recent material.
- Does not render AI Insights.
- Does not render the old quick-stat card wall.
- Does not render the old internal overview/analytics/activity tabs.

The dashboard still fetches dashboard stats because recent material currently comes from the existing dashboard stats hook. Do not reintroduce reporting cards into this page.

### Dedicated Analytics

Analytics were moved out of the dashboard into:

- `web/src/modules/dashboard/components/AnalyticsPage.tsx`

The page contains the existing charts, study patterns, productivity metrics, activity feed, progress widget, monthly summary, and AI usage summary.

Route:

- `/analytics`

Navigation:

- Desktop sidebar: `Analytics`
- Mobile feature menu: `Analytics`

### Standalone Flashcards

A standalone flashcard library was added at:

- `web/src/modules/flashcards/components/FlashcardsLibrary.tsx`

Route:

- `/flashcards`

Navigation:

- Desktop sidebar: `Flashcards`
- Mobile feature menu: `Flashcards`

It uses:

- `web/src/services/flashcardsService.ts`
- API gateway endpoint `flashcards`

This gives flashcards created through AI chat a destination independent of a note.

### Chat Display Persistence

The chat typing replay issue was fixed by persisting `has_been_displayed` when the final typing animation completes.

The client must use the API gateway for this update. The relevant client code is:

- `web/src/modules/aiChat/components/AiChat.tsx`

The API route belongs in:

- `supabase/functions/api/index.ts`

Do not add direct `supabase.from(...)` database calls in client components for this behavior. Use `apiClient` and add a gateway route when needed.

### Chat Duplicate Messages

Optimistic assistant messages were reconciled with authoritative backend messages so temporary `optimistic-*` rows are removed when real message IDs arrive.

Relevant file:

- `web/src/modules/aiChat/hooks/useMessageHandlers.tsx`

## Current Route Wiring

Main app shell routes are registered in:

- `web/src/App.tsx`

Current relevant routes:

- `/dashboard`
- `/analytics`
- `/flashcards`
- `/notes`
- `/documents`
- `/recordings`
- `/quizzes`
- `/chat`
- `/library`

Route-to-tab detection is in:

- `web/src/contexts/AppContext.tsx`

Rendering is in:

- `web/src/modules/layout/components/TabContent.tsx`

Navigation is mainly in:

- `web/src/modules/layout/components/Sidebar.tsx`
- `web/src/modules/layout/components/MobileMenu.tsx`

## Product Workspace: Chat-Centered Study Workspace

The notebook-inspired workspace is the Chat experience itself, not a separate Notebook entity or page. Keep existing feature areas (Documents, Notes, Recordings, Quizzes, Flashcards, Podcasts, and others) as detailed pages/tools connected to this central workspace.

### Workspace Flow

1. Home's **New workspace** action creates a new chat session and opens it.
2. Choosing an older chat session opens the same workspace layout with that session's messages and attached sources.
3. The Chat workspace presents Sources on the left, conversation in the center, and study tools in a Studio panel.
4. Users select existing notes, documents, and recordings as chat sources. Recording transcript/summary content is supplied to Chat.
5. Add-source actions and Studio shortcuts open the existing detailed feature pages; do not duplicate those features inside a new notebook page.

### Target layout

```text
Chat workspace (one view for new and existing sessions)
+------------------------------------------------------------+
| Workspace title                     New workspace         |
+----------------------+-------------------------------------+
| Sources              | Chat conversation                  | Studio
|                      |                                     |
| + Add source        | Ask about selected material         |
| - PDF                |                                     |
| - Note               | Messages and composer               | Flashcards
| - Recording          |                                     | Quiz
|                      |                                     | Podcasts
+------------------------------------------------------------+
```

### Implementation steps

1. Keep Chat session as the existing workspace/session model; do not create a parallel Notebook model without a product/data decision.
2. Build the NotebookLM-inspired shell into the existing AI Chat view.
3. Keep selected source IDs attached to each Chat session and pass source content into Chat.
4. Keep new and older Chat sessions on the same workspace UI.
5. Let Studio actions open the existing detailed tools and preserve source/session context where supported.
6. Add mobile layout validation before expanding the desktop version.

## API Rules

- Web client code must not add direct database calls for product data.
- Use `web/src/services/apiClient.ts`.
- Add or extend routes in `supabase/functions/api/index.ts`.
- Deploy the API function after backend route changes:

```powershell
supabase functions deploy api
```

- Avoid changing the response envelope globally unless all consumers are audited. Existing code has mixed expectations around `apiClient` returning unwrapped data versus metadata.

## Validation Commands

From `web`:

```powershell
npm run build
```

For focused diagnostics, use the VS Code diagnostics tool on touched files.

For edge API changes:

```powershell
supabase functions deploy api
```

## Design Direction

Use a quiet, source-led workspace language inspired by NotebookLM, but keep StuddyHub distinctive:

- Light neutral workspace background with restrained blue as the action color.
- Rounded source cards, but avoid nested card stacks.
- Clear typography hierarchy and short action labels.
- Primary action should be obvious without a tutorial.
- Analytics should be intentionally out of the way.
- Empty states should give one next action, not a list of feature explanations.
- Preserve responsive behavior and keyboard focus states.

## Known Follow-up Risks

- `Dashboard.tsx` still contains legacy unused imports/helpers from the former dashboard implementation. They are harmless at runtime but should be cleaned in a dedicated cleanup pass.
- Dashboard recent material currently comes from `useDashboardStats`; a future notebook home should use a focused source query instead of loading analytics-oriented data.
- Flashcards currently display cards but do not yet provide a complete review session or spaced-repetition workflow in the standalone library.
- API gateway response metadata and `apiClient` unwrapping are inconsistent in older consumers. Avoid broad API client changes without an audit.
- The app has both web and Supabase edge-function code paths. Keep client changes in `web/` and backend routes in `supabase/functions/`.

## Definition Of Done For The Next Milestone

- A user can create a new workspace from Home.
- A user can add at least one existing source type.
- A user can select sources and ask Chat about them.
- A user can open an older Chat session and see the same workspace shell.
- Existing feature pages remain the detailed destination for documents, notes, quizzes, flashcards, and recordings.
- The home screen remains understandable without reading documentation.
- Desktop and mobile builds pass.
