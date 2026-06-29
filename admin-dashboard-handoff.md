# The Complete Athlete Admin Handoff

The user-facing app should only expose Athlete and Parent access.

Admin controls should live outside the app in a secure dashboard or backend. Until that dashboard is built, the Supabase tables below are the source of truth:

- `daily_deposits`: Daily Deposit lessons, release dates, and posted/scheduled status.
- `performance_plans`: Performance plan title, subject, steps, challenge day, and release date.
- `parent_messages`: Parent Corner messaging and schedule.
- `profiles`: User role and display name.
- `parent_links`: Which parent account can view which athlete.

Recommended dedicated admin dashboard permissions:

- Admin can create, edit, schedule, and delete Daily Deposits.
- Admin can preload Performance Plans months in advance.
- Admin can create Parent Corner messages.
- Admin can view users and parent-athlete links.
- Admin should not use the public app login.

Important production note:

Admin writes should happen through a secure admin dashboard or backend using server-side authorization. Do not expose service-role keys in the public app.
