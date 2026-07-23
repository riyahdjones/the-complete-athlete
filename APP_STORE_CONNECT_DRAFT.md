# The Complete Athlete App Store Connect Draft

Last updated: July 23, 2026

Use this as the working copy for App Store Connect. Final legal/privacy answers should be reviewed before public launch, but this matches the app as currently built.

## App Information

App name:
The Complete Athlete

Subtitle:
Mindset for young athletes

Primary category:
Sports

Secondary category:
Health & Fitness

Content rights:
The app uses original performance plan, Daily Deposit, parent, goal, journal, and AI coach content owned by The Complete Athlete.

Age rating recommendation:
4+ if Apple accepts the content as self-improvement/sports education. If Apple flags AI coach, parent/athlete accounts, or faith-based reflective content as more mature, use the rating Apple generates from the questionnaire.

## Promotional Text

Build the habits, mindset, goals, and daily rhythm behind complete athletic growth.

## Description

The Complete Athlete helps athletes grow beyond the scoreboard.

Athletes can read Daily Deposits, track daily productivity, set goals, complete performance plans, journal, build streaks, earn points, and use a mindset coach designed for sports moments like pressure, confidence, slumps, preparation, mistakes, and accountability.

Parents can create a connected experience to follow their athlete's progress, view performance plans, and support the growth process without crowding the athlete's personal reflection space.

Inside the app:
- Daily Deposits for mindset, faith, character, and performance growth.
- Performance Plans built as guided reading experiences.
- Goal and productivity tracking for daily accountability.
- Journaling for reflection and growth.
- Complete Athlete Score points for consistency.
- Parent access for support and accountability.
- My Mindset Coach for practical sports mindset conversations.

The Complete Athlete is not therapy, medical care, emergency support, injury treatment, recruiting advice, or a guarantee of athletic results. It is a growth tool built to help athletes become more intentional, consistent, and complete.

## Keywords

athlete,mindset,goals,sports,parent,coach,journal,habits,training,confidence

## Support URL

https://the-complete-athlete.vercel.app/support.html

## Privacy Policy URL

https://the-complete-athlete.vercel.app/privacy.html

## Marketing URL

https://the-complete-athlete.vercel.app/

## Copyright

2026 The Complete Athlete

## Reviewer Notes

The Complete Athlete is a sports mindset, daily growth, and parent-support app for athletes.

The app includes athlete and parent account flows. Athletes can complete Daily Deposits, goals, productivity tasks, performance plans, journal entries, points/streak activities, and AI mindset coach conversations. Parents can link to an athlete through the parent access flow to support accountability and view approved athlete progress/content.

My Mindset Coach is designed for sports mindset support. It is not therapy, medical advice, diagnosis, emergency support, or injury treatment. Safety boundaries are included in the app and backend. For injury, self-harm, abuse, threats, or danger, the coach directs users to involve a trusted adult, emergency support, or a qualified professional.

Account deletion is available inside the Profile area through the Delete Account flow.

Push notifications are optional and used for Daily Deposits, performance plan updates, streaks, and app reminders.

Review account:
Athlete test account email: [ADD TEST EMAIL]
Athlete test account password: [ADD TEST PASSWORD]
Parent test account email: [ADD TEST EMAIL]
Parent test account password: [ADD TEST PASSWORD]

Suggested review path:
1. Log in as the athlete.
2. Open Home to view Daily Deposit, Today's Focus, productivity, score, and progress.
3. Open Performance Plans and review a plan lesson.
4. Open Goals and Profile.
5. Open Coach and ask a general sports mindset question.
6. Log in as the parent to review the parent portal and performance plan visibility.

## Screenshot Plan

Required screenshots should be captured from TestFlight or Xcode simulator after the final production build.

Recommended iPhone screenshots:
1. Role selection screen.
2. Athlete Home with Daily Deposit and Today's Focus.
3. Performance Plans library.
4. Performance Plan reader.
5. My Mindset Coach.
6. Parent portal.

Recommended iPad screenshots:
1. Athlete Home.
2. Performance Plans library.
3. Performance Plan reader.
4. Parent portal.

Avoid screenshots that show real private user data, real emails, private journal content, or admin-only screens.

## Privacy Nutrition Label Draft

Tracking:
No. The app does not use data to track users across apps or websites owned by other companies.

Data linked to the user:

Contact Info:
- Name
- Email Address

User Content:
- Journal entries
- Goals
- Productivity tasks
- Performance plan progress
- AI coach messages
- Profile photo, if uploaded

Identifiers:
- User ID
- Push notification device token

Usage Data:
- Product interaction, including app activity, plan progress, points, streaks, notification preferences, and coach message usage count

Diagnostics:
- Basic app/backend diagnostics and event logs used to maintain reliability, safety, and account support

Location:
- Coarse location only if the athlete enters state or country in their profile

Other Data:
- Age
- Sport
- Role, such as athlete or parent
- Parent access code/link status

Data not used for tracking:
- All data above is used for app functionality, personalization inside The Complete Athlete, safety, analytics/reliability, notifications, and support. It is not used for third-party advertising or cross-app tracking.

Data purposes to select:
- App Functionality
- Analytics
- Product Personalization
- Developer's Advertising or Marketing: Do not select unless future marketing tracking is added.
- Third-Party Advertising: Do not select.

Sensitive categories to avoid unless the app changes:
- Financial Info
- Precise Location
- Contacts
- Browsing History
- Search History
- Purchases

## Privacy Notes

Journal entries and AI coach chats should remain private from parents unless a future version clearly introduces sharing.

Parents should see accountability/progress information, not private journal or private coach conversation content.

The AI coach may use plan progress, daily deposits, goals, sport, age, and performance plan context to personalize coaching. It should not claim to know private journal entries unless the user directly shares that content in the coach conversation.

## Before Submission Checklist

- Switch APNs from sandbox to production before the App Store build.
- Confirm Privacy Policy and Support URLs load publicly.
- Confirm account deletion is visible in Profile.
- Confirm a reviewer test athlete and parent account exist.
- Confirm AI coach works in the uploaded TestFlight build.
- Confirm push notifications work in TestFlight/production mode.
- Confirm no horizontal scrolling on iPhone 15/16 sizing.
- Confirm all performance plans open and format correctly.
- Confirm App Store screenshots do not reveal private data.
