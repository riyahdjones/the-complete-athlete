# CRM Outreach Mapping

The live CRM is the communication and opportunity system. Supabase remains the research, evidence, qualification, and suppression system of record.

No live CRM fields or records were changed during discovery.

## CRM object strategy

- One CRM Company per school.
- One CRM Contact for the selected adult decision-maker.
- One CRM Opportunity only after the prospect is approved for outreach.
- Do not create separate CRM contacts for every discovered staff member.
- Never sync a suppressed, unverified, duplicate, student, or parent record.

## Standard company fields

| Supabase | CRM company field |
| --- | --- |
| `outreach_schools.name` | Company Name |
| `outreach_schools.website_url` | Website |
| `outreach_schools.address` | Address |
| `outreach_schools.city` | City |
| `outreach_schools.state` | State |
| `outreach_schools.postal_code` | Postal Code |

## Standard contact fields

| Supabase | CRM contact field |
| --- | --- |
| `outreach_contacts.full_name` | First Name + Last Name |
| `outreach_contacts.professional_email` | Email |
| `outreach_contacts.professional_phone` | Phone |
| `outreach_contacts.job_title` | Contact title, if standard field exists |
| `outreach_schools.name` | Company association |

## Custom fields to create before first sync

- School Type
- School Level
- School District
- Georgia County
- Contact Role
- Sport or Department
- Qualification Score
- Qualification Reasons
- Source URL
- Last Verified At
- Outreach Prospect ID
- School ID

## Tags

- `outreach-georgia-schools`
- `school-public`, `school-private`, or `school-charter`
- `role-athletic-director` or the selected fallback role
- `outreach-awaiting-approval`, `outreach-active`, or terminal outcome tag

## Opportunity pipeline

Recommended pipeline name: `Georgia School Outreach`

Recommended stages:

1. Qualified
2. Outreach Approved
3. Contacted
4. Replied / Intro Call
5. Opportunity / Partner

The live CRM supports five stages in this pipeline. More detailed states such
as research completion, speaking opportunity, platform conversation, not-now,
and closed outcomes remain in Supabase and are represented in the CRM through
tags, opportunity status, and custom fields.

## Sync gates

A prospect may enter the CRM only when:

- School qualification status is `qualified`.
- Selected contact has a verified professional email.
- Source evidence is present.
- Contact and school are not suppressed.
- No matching CRM contact or company already exists.
- A human has approved CRM creation for the pilot.

Supabase stores the resulting CRM contact and opportunity identifiers so retries are idempotent and cannot create duplicates.
