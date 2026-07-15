# The Complete Athlete - Project Context

This project is a mindset and performance app for athletes, parents, and administrators.

## Product Direction

- Public app is for athletes and parents only.
- Admin controls live in the separate `admin-dashboard/` app.
- Product name is `The Complete Athlete`.
- Brand mark is `TCA`.
- Tone should feel athletic, clean, focused, premium, simple, and not childish.
- Avoid overly technical UI, clutter, too much neon green, and nested cards.
- Core product promise: each athlete should feel understood, challenged, coached, and hopeful.
- North Star: do not maximize engagement; maximize transformation.
- The 90% philosophy: elite performance is driven primarily by mind, identity, habits, decisions, preparation, and character.

## Local Apps

- Main athlete/parent app: `http://127.0.0.1:5173/`
- Admin dashboard: `http://127.0.0.1:5174/`

## Current Deployment

- Public app Vercel project: `the-complete-athlete`
- Public URL: `https://the-complete-athlete.vercel.app`
- Public app root: repo root
- Admin Vercel project: `the-complete-athlete-admin`
- Admin URL: `https://the-complete-athlete-admin.vercel.app`
- Admin Vercel root directory: `admin-dashboard`
- Both Vercel projects are connected to GitHub repo `riyahdjones/the-complete-athlete`, branch `main`.

## Backend

Supabase is the backend for:

- Auth
- Profiles
- Athlete profiles
- Parent-athlete links
- Goals
- Daily standards
- Standards history
- Readiness checks
- Journal entries
- Daily Deposits
- Performance Plans
- Parent messages
- Athlete privacy settings
- Profile photo storage

Important tables:

- `profiles`
- `athlete_profiles`
- `parent_links`
- `goals`
- `daily_standards`
- `standards_history`
- `readiness_checks`
- `journal_entries`
- `daily_deposits`
- `performance_plans`
- `athlete_privacy_settings`
- `parent_messages`

Storage bucket:

- `athlete-profile-photos`

Important RPC:

- `link_parent_to_athlete(access_code text)`

## Environment Rules

Never expose or commit:

- `.env.local`
- `.env.admin.local`
- `SUPABASE_SERVICE_ROLE_KEY`

Main app environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Admin dashboard environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_DASHBOARD_PASSWORD`

The service role key belongs only on the server-side admin dashboard.

## Auth Model

- Public app supports athlete and parent accounts.
- Admin login was removed from the public app.
- If an admin account tries to access the public app, it should be blocked with: `Admin access has moved outside the athlete app.`

## Parent Flow

Athletes access parent invites from:

- `My Profile -> Parent Access`

Parent access includes:

- Parent email or phone input
- Parent access code
- Copy invite button
- Email button
- Text button

The visible raw invite link should stay hidden because it feels too technical.

Invite links include:

- `?role=parent&parentCode=...`

Parents opening the invite link should land in Parent Create Account mode with the code prefilled.

## Main Features

Home includes:

- Daily Deposit
- Today's Focus question
- Progress Snapshot
- Morning Readiness Check-In
- Daily Standards
- Standards History

Readiness checks measure:

- confidence
- energy
- mood
- belief

Daily Standards:

- Athlete controls standards.
- Athlete can add as many as they want.
- Default standards are:
  - `Quality training session`
  - `Write down goals`
  - `50 extra catches`
  - `Visualize for 5 mins`

Performance Plans:

- Performance Plans should feel like coaching episodes, not educational articles.
- Admin controls plans outside the public app.
- Athlete-facing language should use `Series`, `Episodes`, and `Seasons` over generic content terms when appropriate.
- A series is one transformation told across multiple episodes, not a loose set of articles.
- Each episode should deliver one unforgettable idea and one action the athlete can apply immediately.
- Episodes should help athletes think differently, compete differently, and ultimately become different people.
- Athletes can mark plans complete.
- The next plan unlocks the day after the previous plan is completed.
- Challenges are usually 3 or 7 days.
- Coach should know the athlete's current plan day, unlock status, and completion status.
- Suggested episode structure:
  - Optional cinematic opening
  - The Lesson
  - The Greats
  - The Shift
  - Train Today
  - Film Room
  - Coach's Corner
  - Complete Athlete Principle
  - Next Episode
- Section standards:
  - `The Lesson`: introduce one mental model.
  - `The Greats`: use one true sport story that reinforces the lesson.
  - `The Shift`: connect the story to the athlete's life and identity.
  - `Train Today`: one action that can be completed today.
  - `Film Room`: awareness reflection, not homework.
  - `Coach's Corner`: extend the lesson through AI.
  - `Complete Athlete Principle`: one original memorable sentence.
  - `Next Episode`: create curiosity for what comes next.

Reflect:

- Journal and goals live together.
- Journal prompt: `Write what you need to remember.`
- Placeholder: `Express freely`
- Goals are fully controlled by the athlete.
- Achievements only reflect goals completed at 100%.

Mindset Coach:

- Public label: `My Mindset Coach`
- Description: `AI powered mental performance coach`
- Coach should be supportive but honest, not a yes-man.
- Coach should avoid medical or clinical claims.
- AI is a coach, not a mind reader.
- Coach should never assume facts about the athlete.
- Coach should ask thoughtful questions, apply today's lesson, build routines/action plans, challenge thinking, and encourage reflection.
- Good coach prompts include:
  - `Help me apply today's lesson to my next practice.`
  - `Ask me questions that help me understand today's principle.`
  - `Help me create a plan using today's lesson.`
  - `Challenge my thinking about today's episode.`
- Coach can use Daily Deposit, Today's Focus, Performance Plans, current plan day, plan unlock status, plan completion status, goals, standards, and athlete profile context.

## Content Bible

Source: `/Users/rjmillionaire/Downloads/The_Complete_Athlete_Bible_v1.docx`

Writing voice should feel like:

- A world-class coach after practice.
- A bestselling author.
- A sports documentary narrator.

Avoid:

- Empty motivation.
- Cliches.
- Long lectures.
- Talking down to athletes.

Target audience:

- Ages 12-18, while still resonating with parents and coaches.

Writing principles:

- One unforgettable idea per episode.
- One emotional transformation per series.
- Teach mental models, not slogans.
- Use simple language with deep ideas.
- End with curiosity.
- Every sentence must earn its place.

Core themes:

- Identity over performance.
- Preparation over panic.
- Standards over motivation.
- Habits over hype.
- Attention directs performance.
- Confidence is earned.
- Character lasts longer than results.
- Every setback can become training.

Storytelling rules:

- Rotate stories across sports: baseball, football, basketball, soccer, tennis, golf, swimming, track, volleyball, hockey, gymnastics, combat sports, motorsports, etc.
- Use defining moments, not biographies.
- The story exists to teach the lesson.

Film Room rules:

- Reflection should reveal awareness.
- Focus on: what did I notice, what did I learn, what will I do next?
- Questions should invite honesty, not perfection.

Quality test before publishing:

- Would a 13-year-old understand this?
- Would a college athlete respect it?
- Would a parent screenshot it?
- Would a coach share it?
- Is there one sentence they will remember years later?

Profile:

- Photo upload
- Age
- State or country
- Parent contact
- Parent invite/access
- Privacy controls

Privacy:

- Readiness trend can be visible to parent.
- Standards submitted can be visible to parent.
- Goals summary can be visible to parent.
- Journal remains private.
- Coach chats remain private.

## Admin Dashboard

Admin dashboard includes:

- Daily Deposit create/edit/delete
- Performance Plan create/edit/delete
- Parent Corner message control
- Recent users view
- Parent-athlete links view

Admin dashboard uses Supabase service role key server-side only.

## Next Priorities

1. Test parent flow end to end.
2. Confirm parent dashboard sees linked athlete data.
3. Add production-grade admin authentication.
4. Connect Daily Deposit push notifications.
5. Build real AI backend for My Mindset Coach with guardrails.
6. Clean up onboarding and first-run experience.

## Files To Inspect Before Changes

- `src/main.jsx`
- `src/styles.css`
- `admin-dashboard/app/page.jsx`
- `admin-dashboard/app/actions.js`
- `supabase-production-upgrade.sql`
