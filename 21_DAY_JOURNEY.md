# Personalized First 21

The first Journey extends the app's existing systems. It does not create a second points total or duplicate Performance Plan lessons.

## Source of truth

- Performance Plan days reference existing plan IDs. Completion is read from `performance_plan_progress`.
- Performance Points continue to use `athlete_points_ledger` and its existing unique event keys.
- Integration Days live in the Journey record and earn one deduplicated ledger event per completed day.
- Journey state is cached locally and syncs through `athlete_journeys` after applying `supabase-athlete-journeys.sql`.

## Journey record

The JSON record stores the eight onboarding answers, derived development tags, scored and selected plan series, and exactly 21 ordered days. A day is either an existing Performance Plan lesson reference or a Journey-specific Integration Day. Day 21 is always the Journey review.

## UI states

- New athlete: Journey-building onboarding and reveal.
- Active Journey: premium card directly below Daily Deposit on Today.
- Completed Journey: smaller Next Focus card replaces the large Journey card.

## Point safety

Plan lessons keep their existing awards. The Journey only observes those completions. Integration and Journey-completion awards use stable keys based on Journey ID and day, so reopening or resubmitting cannot award PP twice.
