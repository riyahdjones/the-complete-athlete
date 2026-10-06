# Spanish localization status

## Completed on 2026-10-02

- Applied `supabase-localization.sql` to the production database after explicit user approval. This adds language preference and Spanish content columns; it does not replace English content.
- Generated 44 bundled Spanish lesson drafts and 1,465 interface dictionary entries. Google rate-limited the last part of the interface batch; those remaining entries were translated locally.
- Added language selection, preference persistence, localized plan selection, Spanish coach instructions, language-specific ElevenLabs requests/cache keys, and Spanish authentication email templates.
- Corrected several literal sports translations, including slump → mala racha. This is not a complete editorial review.
- Verified parent language switching in the local preview. The preview still contains untranslated dynamic labels and live content.

## Required before public release

- Review all lesson drafts for natural Spanish, consistent informal address, terminology and accurate meaning.
- Translate published database content: daily deposits, parent messages, parent guides and any plans absent from the bundled seeds. Spanish columns currently permit English fallback.
- Complete dynamic UI strings, legal/support pages, and remaining notification categories.
- Replace broad DOM dictionary translation with explicit component translation calls as screens are audited. Protect all user-authored names, goals, activities, messages and journal entries from translation.
- Complete athlete/parent onboarding, paywall, plan-reader, audio, journal and notification acceptance tests in Spanish, including native iOS.
- Provide an admin editing/review workflow for ongoing bilingual content.
- Deploy web/API changes and create a new native build only after the release checks pass.

The localization changes have not been pushed or deployed. A successful build alone does not establish translation completeness.
