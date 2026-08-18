# Georgia School Outreach Agent Blueprint

## Campaign objective

Build a scalable outbound prospecting system that identifies qualified Georgia middle schools and high schools, reaches appropriate adult decision-makers, and creates opportunities for Riyahd Jones to speak to student-athletes and introduce The Complete Athlete as an ongoing mental-performance and athlete-development resource.

The first outreach exists to start a conversation and book a 15-minute introductory call. It must lead with the speaking opportunity and athlete value, not an immediate software sale.

## Phase 1 scope

- Geography: Georgia, beginning with Metro Atlanta and surrounding counties, then expanding statewide.
- School levels: middle school and high school.
- School types: public, private, and charter.
- Athletic scope: all organized school sports.
- Primary contact: Athletic Director or Director of Athletics.
- Secondary contacts: Assistant Athletic Director, Head Coach, Principal or Assistant Principal, Student Activities Director, Athletic Coordinator, strength/performance staff, counselor/student-development staff, or district athletic administrator.
- Primary CTA: book a 15-minute introductory call.
- Explicit exclusions: students, parents, elementary-only schools, schools outside Georgia, personal contact data, prior opt-outs, existing customers/partners, duplicates, and organizations without a legitimate school athletic program.

## Product positioning

The Complete Athlete helps schools develop the part of the athlete traditional training often leaves untouched: the mind.

The speaking experience creates the spark. The Complete Athlete gives athletes a system to continue the work through mental-performance plans, daily focuses, goal tracking, priorities, journaling, reflection, practical exercises, accountability, parent resources, and AI-supported guidance.

Approved topic areas include confidence, self-image, pressure, adversity, goals, discipline, habits, focus, leadership, emotional control, visualization, preparation, and identity beyond performance.

## System workflow

1. Discover schools from approved sources.
2. Verify Georgia location, grade levels, official website, and organized athletics.
3. Locate the official school, district, athletics, and staff-directory pages.
4. Identify the Athletic Director first and eligible secondary contacts only when needed.
5. Extract public professional contact details and retain source evidence.
6. Identify sports and relevant athlete-development signals when available.
7. Deduplicate schools and contacts.
8. Apply exclusions and the permanent suppression list.
9. Verify work-email deliverability without inventing or guessing an address.
10. Calculate a qualification score and record the reasons.
11. Generate a source-grounded personalization brief.
12. Draft an approved outreach message.
13. Require human approval for initial MVP sends.
14. Track delivery, replies, follow-ups, meetings, and campaign outcomes.
15. Stop all follow-ups immediately after an opt-out, negative reply, hard bounce, or successful meeting booking.

## Approved source policy

Preferred sources, in order:

1. Official school websites.
2. Official district websites.
3. Official athletic department websites.
4. Official staff directories.
5. State education or athletic-association directories.
6. Verified professional organization pages.
7. Licensed business-contact providers.

The system must not bypass authentication, CAPTCHAs, paywalls, technical access controls, or site restrictions. It must respect site terms, robots directives, and reasonable rate limits. Search engines may help locate a source, but important contact facts should be tied to the underlying official or licensed page.

The system must not collect student information, sensitive personal data, or personal email addresses unless an address is clearly published for the person's professional school role. It must not infer or guess unverified contact information.

## Core data model

### `schools`

- `id`
- `name`
- `normalized_name`
- `school_type`: public, private, or charter
- `grade_levels`
- `address`
- `city`
- `county`
- `state`
- `postal_code`
- `district_name`
- `website_url`
- `athletics_url`
- `staff_directory_url`
- `enrollment`
- `sports_offered`
- `has_organized_athletics`
- `priority_signals`
- `qualification_status`
- `qualification_score`
- `qualification_reasons`
- `source_urls`
- `last_verified_at`
- `created_at`
- `updated_at`

### `contacts`

- `id`
- `school_id`
- `full_name`
- `job_title`
- `contact_role`
- `sport`
- `professional_email`
- `professional_phone`
- `email_status`: unverified, valid, risky, invalid, or unavailable
- `is_primary_contact`
- `source_url`
- `source_excerpt`
- `last_verified_at`
- `do_not_contact`
- `created_at`
- `updated_at`

### `prospects`

- `id`
- `school_id`
- `contact_id`
- `campaign_id`
- `status`: discovered, qualified, research_ready, draft_ready, awaiting_approval, approved, active, replied, meeting_booked, disqualified, suppressed, or closed
- `priority_score`
- `personalization_brief`
- `personalization_evidence`
- `owner`
- `next_action_at`
- `created_at`
- `updated_at`

### `messages`

- `id`
- `prospect_id`
- `thread_id`
- `message_type`: initial, follow_up, reply, or internal_note
- `subject`
- `body`
- `approval_status`
- `scheduled_at`
- `sent_at`
- `delivery_status`
- `provider_message_id`
- `model_version`
- `prompt_version`
- `created_at`

### `source_evidence`

- `id`
- `school_id`
- `contact_id`
- `url`
- `source_type`
- `field_supported`
- `captured_text`
- `retrieved_at`
- `content_hash`

### `suppressions`

- `id`
- `email`
- `domain`
- `school_id`
- `reason`
- `scope`: contact, school, or domain
- `created_at`

### `campaign_events`

- `id`
- `campaign_id`
- `prospect_id`
- `event_type`
- `metadata`
- `occurred_at`

## Qualification gate

A prospect proceeds only when all required conditions are true:

- The organization is in Georgia.
- It serves middle-school and/or high-school students.
- It has an organized athletic program.
- It is a public, private, or charter school.
- A legitimate official school or district site is verified.
- An eligible adult decision-maker is identified.
- The record is not excluded or suppressed.

Failure of any required condition sends the record to `disqualified` with a machine-readable reason.

## Priority scoring

Use a 100-point explainable score. Missing optional data should not be treated as negative evidence.

- 25 points: Athletic Director with a publicly listed professional email.
- 15 points: multiple varsity or organized sports are confirmed.
- 10 points: established athletics website or department page.
- 10 points: strong or active athletics communications presence.
- 10 points: evidence of leadership, character, wellness, counseling, or performance initiatives.
- 10 points: larger enrollment or broad grade coverage.
- 10 points: located in the initial Metro Atlanta priority region.
- 5 points: performance, strength, or student-development staff exists.
- 5 points: school contact data was verified recently from an official source.

Suggested routing:

- 75–100: high priority.
- 50–74: standard priority.
- 30–49: research further.
- Below 30: hold unless manually selected.

Smaller schools must remain eligible; size affects priority, not qualification.

## Contact-selection rules

1. Select one Athletic Director as the primary contact when a verified professional address is available.
2. If unavailable, select the most appropriate eligible secondary contact based on role and available evidence.
3. Do not contact multiple people at the same school simultaneously during the initial sequence.
4. If the primary contact refers the outreach to another adult, stop the original sequence and create a referred-contact record.
5. Keep contacts with unavailable email addresses for later research; never fabricate an address.

## Personalization contract

Every generated message must be supported by stored evidence. Suitable personalization includes:

- Recipient's verified professional role.
- School name, city, district, or school type.
- Confirmed sports or breadth of athletic programs.
- Published leadership, wellness, character, counseling, or athlete-development initiatives.
- A recent public athletics achievement only when accurately sourced and relevant.

The agent must not invent familiarity, imply it reviewed information it did not access, mention students by name, or use superficial praise. If no meaningful evidence exists, it should use restrained role-and-school personalization.

## Message strategy

The initial message should:

- Be concise and written for a busy school leader.
- Begin with a relevant athlete-development problem or observation.
- Establish Riyahd Jones's credible connection to high-level athletics and mental-performance education.
- Explain the practical value of a student-athlete speaking session.
- Mention The Complete Athlete only as the ongoing system behind the work.
- Ask for a 15-minute introductory call.
- Include a simple, visible opt-out mechanism and required sender information.

Follow-ups should add useful context rather than repeat the first message. The initial MVP should use no more than two follow-ups, stop immediately on any reply, and avoid aggressive urgency.

## Reply routing

- `interested`: notify Riyahd, draft a response, and offer approved meeting times.
- `more_information`: draft a concise response with approved collateral.
- `referral`: create or update the referred adult contact and stop the old sequence.
- `not_interested`: close the prospect and suppress further campaign outreach as appropriate.
- `unsubscribe`: add immediately to the permanent suppression list.
- `out_of_office`: pause until the stated return date; do not count as engagement.
- `wrong_contact`: request or process an adult professional referral when offered.
- `sensitive_or_uncertain`: require human review; never auto-reply.

## MVP controls

- Human approval required before every initial message and follow-up.
- Daily send cap configurable by mailbox and campaign.
- Only verified professional addresses may be sent automatically.
- One active sequence per school.
- Suppression checked immediately before every send.
- Complete audit log for research, scoring, drafts, approvals, sends, and state changes.
- Global campaign pause/kill switch.
- Role-based access for campaign operators.
- No automatic reply beyond low-risk scheduling until reply classification is validated.

## MVP acceptance criteria

The first release is ready for a controlled pilot when it can:

1. Import or discover a 20-school Georgia test set.
2. Correctly qualify at least 19 of the 20 schools against manually reviewed ground truth.
3. Identify the correct primary decision-maker for at least 18 of the 20 schools, or explicitly report that a verified contact was unavailable.
4. Provide a valid supporting source for every stored school and contact fact.
5. Produce no student contacts, personal emails, duplicates, or invented email addresses.
6. Apply suppressions before draft approval and again before sending.
7. Produce drafts that contain no unsupported personalization claims.
8. Track approvals, sends, replies, meetings, opt-outs, bounces, and errors.
9. Export records and audit history without losing evidence provenance.

## Recommended build order

### Milestone 1: data foundation

- Add the outreach tables and row-level access controls to Supabase.
- Create permanent suppression enforcement.
- Add normalized deduplication keys for schools, domains, contacts, and emails.
- Define campaign configuration and workflow-state transitions.

### Milestone 2: research pipeline

- Seed official Georgia school records.
- Discover official school, athletics, and staff-directory URLs.
- Extract adult decision-makers and professional contacts.
- Save field-level source evidence and verification timestamps.
- Apply qualification and priority scoring.

### Milestone 3: internal review dashboard

- Add school and contact review queues to the existing admin dashboard.
- Display source evidence alongside every editable fact.
- Support approve, reject, merge duplicate, suppress, and request-more-research actions.

### Milestone 4: messaging and mailbox integration

- Add campaign templates, personalization rules, and versioning.
- Generate drafts from approved facts only.
- Connect Gmail or Outlook for draft creation and sending.
- Enforce send caps, approval requirements, suppression, and idempotency.

### Milestone 5: inbox and outcomes

- Ingest replies and preserve thread context.
- Classify replies and route them according to policy.
- Add follow-up scheduling and stop conditions.
- Track meetings and performance by school type, geography, contact role, and message version.

### Milestone 6: controlled pilot

- Manually verify 20 schools as the regression test set.
- Pilot with 50–100 approved contacts.
- Review sourcing accuracy, bounce rate, positive-reply rate, meeting rate, opt-outs, and complaints.
- Expand daily volume only after quality and deliverability thresholds are met.

## Decisions still required before sending

- The initial Metro Atlanta counties or exact statewide rollout order.
- The sending mailbox and authenticated domain.
- Riyahd's approved biography and claims, with supporting links.
- Scheduling link and available meeting windows.
- Approved speaking formats, travel boundaries, and whether pricing is discussed before the introductory call.
- Approved collateral: speaker overview, platform overview, testimonials, case studies, and video.
- Legal review of outreach language, retention, and regional requirements.
- Pilot send cap and follow-up interval.

