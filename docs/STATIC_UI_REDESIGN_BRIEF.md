# StuddyHub Static UI Redesign Brief

**Status:** Design direction for the public/static web pages
**Scope:** Unauthenticated pages only. Protected product routes are intentionally unavailable during maintenance and are out of scope.
**Audience:** Students, educators, parents/partners, developers, applicants, and support visitors.

## 1. Executive verdict

The current static pages are clean, readable, and structurally consistent, but they feel like one generic component library stretched across many jobs. The repeated formula is:

- shared white header
- blue primary action
- gray section background
- rounded bordered cards
- screenshot-backed hero with a dark gradient
- three-column card grid

That formula is functional, but it makes the homepage, documentation, careers, integrations, blog, and support pages feel interchangeable. The redesign should keep the existing clarity and accessibility while giving each page a clear editorial purpose.

The central design idea is **Study in progress**: the public site should feel like a desk where real learning is happening. Use authentic product screenshots, notes, document fragments, transcripts, quiz questions, audio waveforms, and timetable marks as the visual vocabulary. Do not use generic abstract SaaS decoration.

## 2. What is already working

- The brand is immediately visible in the header.
- The public navigation is understandable: Features, Resources, Pricing, About, Contact, Sign In.
- The primary blue action is recognizable and consistent.
- Screenshots make the product tangible and are more credible than invented illustrations.
- The static pages have meaningful content rather than empty marketing copy.
- Dark mode support is already present and should be preserved.
- The maintenance screen correctly communicates that the web product is unavailable and directs Android users to the app.

## 3. What is making the UI feel basic

### Visual repetition
The same rounded card, border, shadow, and three-column grid appears on too many pages. Cards should be reserved for genuinely independent items, not used as the default container for every paragraph.

### Weak page hierarchy
Many pages begin with a large image and centered overlay text. The image often does not add information, and the important action is pushed below the fold. A page hero should state the page's job and show the most relevant proof or action immediately.

### Low-contrast rhythm
The white/gray/blue palette is safe but visually flat. The screenshots show a lot of empty pale space, while the product itself has richer material that could carry the page.

### Product story is buried
The homepage's strongest assets are the actual app screens, but the first viewport is mostly text and blank space. Visitors should understand what StuddyHub does by seeing the product in use, not only by reading a feature list.

### Resources are treated like marketing
Documentation and the user guide are currently card grids. People visiting these pages are trying to find an answer. They need a persistent table of contents, search or clear topic navigation, scannable sections, and stable deep links.

### Mixed visual languages
The public header, marketing pages, legal pages, auth, and maintenance page do not feel like the same family. Establish one public shell and then allow page-specific composition within it.

## 4. New visual direction

### Personality
Calm, intelligent, practical, and student-made. The site should feel closer to a beautifully organized study desk or annotated notebook than to a generic startup landing page.

### Palette
Use a restrained paper-and-ink base with a warm Ghana-inspired accent, while retaining blue as the product action color:

- Ink: `#122033`
- Paper: `#F7F8F5`
- White: `#FFFFFF`
- Product blue: `#2F5BEA`
- Warm accent: `#E56B4D`
- Quiet teal: `#168C86`
- Rule: `#D8DEE8`
- Muted text: `#657083`

Do not turn every page into a multicolor theme. The accent should identify a page or state, not decorate every card.

### Typography
Choose a distinctive display face with a human editorial character and a highly readable sans-serif for body copy. Suggested pairing:

- Display: `DM Serif Display` or `Fraunces`, used only for major page theses and selected pull quotes.
- Body/UI: `Manrope` or `Plus Jakarta Sans`, used for navigation, controls, labels, and paragraphs.
- Code/data: `IBM Plex Mono`, only for API examples, version labels, and technical metadata.

Do not use the same heavy sans-serif treatment for every heading. Use sentence case, shorter headings, and intentional line lengths.

### Layout
- Keep a stable public header, but make it quieter and slightly shorter.
- Use a maximum content width of approximately 1180px.
- Prefer asymmetric editorial compositions over repeated centered blocks.
- Use full-width bands only when they communicate a change of context.
- Use borders and rules more often than shadows.
- Keep card radius modest, around 8px or less. Avoid nested cards.
- On mobile, preserve the visual order: thesis, proof, action, detail.
- Every page needs a meaningful first viewport; do not begin with a large empty top margin.

### Signature element
Create a reusable **study strip**: a narrow horizontal band containing a real product artifact, such as a highlighted note line, document excerpt, transcript timestamp, or quiz prompt. It can sit under the hero or between major sections. This gives the public pages a recognizable StuddyHub signature without adding ornamental blobs or generic gradients.

## 5. Page-by-page verdicts and redesign jobs

### `/` Landing page
**Verdict:** Strongest content base, weakest first-viewport use of product proof. The current hero is too empty and the feature grid arrives as a generic catalog.

**New job:** Make a visitor understand the product in ten seconds and choose either `Explore the app` or `Download for Android`.

**Direction:**
- Hero: bold thesis on the left, real dashboard or notes screenshot on the right, with a visible study strip crossing the composition.
- Show one clear primary CTA and one quiet secondary CTA.
- Move the release update into a compact announcement bar rather than a full-height block.
- Replace the six equal feature cards with three product stories: `Understand`, `Organize`, `Study together`.
- Let each story pair a short explanation with a real screenshot and one concrete outcome.
- Use stats only when they are meaningful and verified; do not let small numbers dominate the page.
- Keep testimonials, but make them human and editorial rather than another carousel card.

### `/about-us`
**Verdict:** Credible information, but it reads like a product catalog followed by a team directory.

**New job:** Establish why StuddyHub exists and why Ghana is part of the product's identity.

**Direction:**
- Lead with the origin story and a real founder/team image or location context.
- Replace the eight-feature grid with a visual timeline: capstone project, first users, current product, next horizon.
- Present values as four short principles with evidence, not generic cards.
- Keep team portraits, but use a tighter editorial layout with roles and one human sentence each.
- End with two paths: `Work with us` and `Talk to the team`.

### `/contact`
**Verdict:** Useful form and information, but the page spends too much space on generic hero imagery before the actual task.

**New job:** Help a visitor reach the right person quickly.

**Direction:**
- Put the contact choice and form above the fold.
- Replace quick-link cards with a simple route selector: `Support`, `Feedback`, `Partnership`, `Press`.
- Keep location, email, phone, and response time as compact contact facts beside the form.
- Make success, validation, loading, and error states explicit and accessible.
- Use a real location or team image only if it supports trust; do not use an unrelated app screenshot as the hero.

### `/blogs`
**Verdict:** The featured post and metadata are good foundations, but the page is still a standard blog card grid.

**New job:** Make useful student knowledge easy to browse and make the publication feel alive.

**Direction:**
- Use a featured story with a strong editorial headline and visible reading time.
- Add category filters or tabs and a compact search field.
- Reduce image repetition; use one strong image per story and let typography carry the rest.
- Give article cards a clear date, category, reading time, and `Read article` action.
- Show a useful empty state when there are no posts in a category.

### `/integrations`
**Verdict:** The available/planned distinction is useful, but image headers and repeated cards make it feel like a dashboard rather than a public capability page.

**New job:** Explain what connects to StuddyHub now and what is planned.

**Direction:**
- Start with a simple availability map: `Available`, `Planned`, `Internal only`.
- Use recognizable integration marks or restrained line icons where legally appropriate; do not imply partnerships that do not exist.
- Show each integration as a row with status, purpose, and a short action.
- Keep the roadmap honest and date-free unless dates are committed.
- Put API and request-integration actions in a quiet bottom band.

### `/careers`
**Verdict:** The mission copy is promising, but job cards use product screenshots as decoration and make every role look the same.

**New job:** Help the right people imagine contributing to the mission.

**Direction:**
- Lead with mission, location, working style, and a direct application action.
- Show open roles as a scannable list with department, location, type, and one-line impact. Use expandable details instead of six image cards.
- Make benefits evidence-based and concise.
- Use team photography or work artifacts, not unrelated product screenshots, for culture sections.
- Provide a clear no-openings state if the list becomes empty.

### `/documentation-page`
**Verdict:** Visually polished but functionally too close to a marketing page. The six cards make users scan instead of find.

**New job:** Route visitors to the correct answer in one or two clicks.

**Direction:**
- Add a documentation header with search, topic navigation, and a clear `Start here` path.
- Replace image-heavy cards with compact topic rows that include title, audience, and estimated reading time.
- Keep FAQ content in an accordion with deep-linkable questions.
- Separate user help from developer documentation visibly.
- Use screenshots inside articles, not as decorative thumbnails for every category.

### `/user-guide-page`
**Verdict:** Content-rich but dense and long. The repeated cards and large icon treatments create visual noise.

**New job:** Teach a new user how to complete the first useful study task.

**Direction:**
- Begin with a short onboarding path: `Create a note`, `Ask AI`, `Turn it into a quiz`.
- Add a sticky in-page navigation on desktop and a compact select/navigation drawer on mobile.
- Use numbered steps only for real sequences.
- Give each section a clear task title, prerequisites, steps, and expected result.
- Move advanced feature reference material below the beginner path.

### `/api`
**Verdict:** Honest status messaging, but the visual treatment is too similar to the consumer resource pages and the code example is not yet a real API reference.

**New job:** Set developer expectations and show the path to access.

**Direction:**
- Use a technical layout: left-side section navigation, right-side content, monospace endpoint labels.
- Clearly label `Internal only` and `Coming soon` capabilities.
- Show request/response examples only when they are accurate and runnable.
- Keep code blocks full-width enough for mobile horizontal scrolling.
- Make `Request early access` the one clear action.

### `/privacy-policy` and `/terms-of-service`
**Verdict:** These pages should be quiet and trustworthy, but they currently inherit too much marketing-page framing.

**New job:** Make important legal information easy to read and verify.

**Direction:**
- Remove photo-backed heroes and decorative cards.
- Use a narrow reading column, document title, effective date, table of contents, and strong heading hierarchy.
- Add an accessible print/download action if supported.
- Keep the public header and footer, but reduce visual noise around the document.

### `/auth` and `/reset-password`
**Verdict:** These are task pages, not marketing pages. They must remain visually connected to the brand while minimizing distraction.

**New job:** Let a user authenticate or recover access with confidence.

**Direction:**
- Use a focused split layout: concise brand promise or study artifact on one side, form on the other.
- Preserve clear labels, password requirements, error messages, loading states, and keyboard focus.
- During maintenance, ensure protected-route behavior remains unchanged and these pages follow the intended access policy.

### `/pricing`
**Verdict:** Pricing is listed in navigation and routes but must not look like an unfinished protected product surface.

**New job:** Explain plan differences without forcing a user into the unavailable app.

**Direction:**
- Use a comparison table or clearly differentiated plan columns with one recommended plan.
- Explain limits in student language, not backend terminology.
- State what is available during maintenance and what action is currently unavailable.
- Avoid fake urgency, inflated badges, or dense feature checklists.

### `/maintenance`
**Verdict:** The message is clear and the Android-specific download behavior is useful. The page is visually isolated from the public brand and offers too little context about what visitors can still do.

**New job:** Explain the temporary limitation and offer the next best action.

**Direction:**
- Reuse the public logo/header language without exposing protected navigation.
- Use a calm status panel with a visible maintenance indicator, last-updated or version context, and the appropriate device action.
- Desktop: explain that the Android app is available and show a QR code if one can be supported safely.
- iOS: state availability plainly and provide a neutral alternative such as status/contact.
- Desktop visitors: provide public-page links such as About, Documentation, and Contact rather than only saying to use Android.
- Preserve download progress, success, and failure states.

### `/404` and other utility states
**Verdict:** These states should feel intentional rather than like a missing page.

**New job:** Recover navigation without blame.

**Direction:**
- Use one clear explanation, one primary return action, and two useful public links.
- Use a small study artifact or typographic detail as the signature, not a generic illustration.
- Keep the page fully usable during maintenance.

## 6. Shared component rules

- One public header and one public footer across all static pages.
- Header: logo, primary navigation, download action, theme toggle, and compact mobile menu.
- Do not show protected product destinations as if they are currently available during maintenance.
- Use sentence case for headings and controls.
- Buttons describe the result: `Download Android app`, `Read the guide`, `Send message`, `Request access`.
- Use icons to reinforce actions, never as the only label for an unfamiliar action.
- Use one primary CTA per section.
- Prefer `border + surface` over heavy shadows.
- Keep interactive focus states visible in both themes.
- Respect `prefers-reduced-motion`.
- Use real screenshots with meaningful captions and alt text.
- Never use a screenshot merely to fill a card header.

## 7. Responsive acceptance criteria

- At 320px wide, no horizontal page overflow.
- Mobile navigation is keyboard accessible and closes after navigation.
- Every first viewport contains the page title, purpose, and next action.
- Tables and code examples have an intentional mobile treatment.
- No card title, button label, or metadata row is clipped or wraps awkwardly.
- Touch targets are at least 44px high.
- Legal and documentation pages remain comfortable to read on narrow screens.
- Hero images never obscure the title or primary action.

## 8. Implementation order

1. Establish public design tokens, typography, header, footer, buttons, links, surfaces, and the study strip.
2. Redesign the landing page as the visual reference page.
3. Apply the shell to About, Contact, Blog, Careers, and Maintenance.
4. Rebuild Documentation and User Guide around wayfinding and task completion.
5. Rebuild API and Integrations with technical information layouts.
6. Simplify legal, auth, reset, pricing, and utility states.
7. Test light/dark themes, mobile widths, keyboard navigation, maintenance behavior, and screenshot loading.

## 9. Copy-paste prompt for the UI agent

```text
Redesign only StuddyHub's unauthenticated/static web pages. Protected routes are intentionally locked for maintenance and must remain unavailable. Work from the existing React/Tailwind structure and preserve route behavior, SEO, dark mode, accessibility, and real asset paths.

The current UI is clean but generic because it repeats white headers, blue buttons, gray backgrounds, rounded bordered cards, screenshot-backed gradient heroes, and three-column grids. Keep the clarity, but give each page a distinct job and composition.

Visual direction: "Study in progress". Use real study artifacts as the visual language: notes, document excerpts, transcripts, quiz prompts, audio waveforms, timetable marks, and authentic product screenshots. Do not use generic SaaS illustrations, decorative blobs, excessive gradients, or screenshot thumbnails that have no informational purpose.

Use a paper-and-ink base with product blue and one warm accent. Suggested tokens: ink #122033, paper #F7F8F5, white #FFFFFF, blue #2F5BEA, warm #E56B4D, teal #168C86, rule #D8DEE8, muted #657083. Pair a characterful display face such as DM Serif Display or Fraunces with Manrope or Plus Jakarta Sans for UI/body text. Use IBM Plex Mono only for technical metadata and code.

Create a shared public header/footer and a reusable narrow "study strip" containing a real product artifact. Use modest 8px-or-less radii, borders over heavy shadows, sentence-case copy, visible keyboard focus, reduced-motion support, and responsive layouts down to 320px.

Page jobs:
- Home: show the product in use in the first viewport; use one primary CTA and three product stories instead of six generic feature cards.
- About: tell the Ghana-origin story with a timeline and real people.
- Contact: put contact routing and the form above the fold.
- Blog: add category browsing, reading metadata, and editorial hierarchy.
- Integrations: show Available, Planned, and Internal only as a truthful capability map.
- Careers: use a scannable role list and mission evidence, not screenshot cards.
- Documentation: prioritize search, topic navigation, FAQ accordions, and user/developer separation.
- User Guide: teach a first useful task with steps and sticky in-page navigation.
- API: use a technical reference layout and accurately label internal/coming-soon access.
- Legal: use a narrow document layout without marketing hero imagery.
- Auth/reset/pricing: keep them focused and brand-connected; do not imply protected access during maintenance.
- Maintenance: explain the temporary web outage, preserve Android download states, and offer useful public links for desktop/iOS visitors.
- 404: provide a clear recovery action and useful public navigation.

Do not redesign protected dashboards or change the maintenance gate. Before finishing, verify all static routes at desktop and mobile widths, check for overflow and clipped text, test keyboard focus, test light/dark mode, and confirm that every page has a clear first-viewport hierarchy.
```
