# Development Phase Plan

This document is the canonical roadmap before moving into the next development phase. Each phase must pass its test gate, then stop for user approval before the next phase begins.

## Phase 1: Make It Safe

Status: Completed in code, pending hosted Supabase SQL application.

Completed:

- Resolved merge conflicts in the simplified couple journey.
- Rebuilt the main flow around login/signup, partner invite, and one shared dinner list.
- Added password reset and update-password pages.
- Added delete confirmation before removing food items.
- Added server-side Supabase safety functions:
  - `create_couple`
  - `join_couple_by_invite_code`
  - `get_my_couple`
- Added database protection for:
  - Maximum two members per couple.
  - Preventing one user from joining multiple couples.
  - Removing direct client-side room/member creation.
  - Removing global room reads.
- Updated frontend data access to use the new RPC functions where available.

Phase 1 notes:

- `npm run build` passed after the Phase 1 code changes.
- The hosted Supabase project still needs the updated SQL applied through `supabase/repair_schema.sql` or equivalent migration.
- Supabase MCP is configured and authenticated.
- Supabase URL/connectivity previously caused `Failed to fetch`; verify hosted project reachability before auth testing.

## Phase 2: Make It Feel Like a Couple App

Status: Completed in code, pending hosted Supabase SQL application.

Goal: Make the app feel less like a generic room tool and more like a shared couple experience.

Completed:

- Add nickname/profile setup for the current user.
- Show partner status clearly on the home screen.
- Add a stronger invite waiting state after one user creates an invite.
- Add a share invite action, using Web Share API when available and clipboard fallback.
- Clean up visible wording so the product says couple, partner, invite, and shared list instead of room language.
- Add realtime partner-join updates so the inviter sees the connection happen without a refresh.

Phase 2 notes:

- `npm run build` passed after the Phase 2 code changes.
- The hosted Supabase project still needs the updated SQL applied through `supabase/repair_schema.sql` or equivalent migration.
- Stop after tests pass and ask for user approval before Phase 3.

## Phase 3: Make Dinner List Useful

Status: Completed in code, pending hosted Supabase SQL application.

Goal: Make the shared dinner list valuable after the first few items.

Completed:

- Add edit support for food items.
- Add useful food fields such as category, notes, price level, and favorite.
- Add search and filtering.
- Add tried/eaten history.
- Improve the random picker so users can mark a picked item as eaten or retry with better context.

Phase 3 notes:

- `npm run build` passed after the Phase 3 code changes.
- If schema changes are introduced, verify SQL/RLS/RPC expectations before continuing.
- Stop after tests pass and ask for user approval before Phase 4.

## Phase 4: Quality

Status: Completed in code and docs, pending hosted Supabase SQL/application verification.

Goal: Tighten reliability, maintainability, and user polish.

Completed:

- Added a lightweight `npm test` smoke check for critical app/schema wiring.
- Converted setup and Supabase repair notes into `README.md`.
- Replaced real-looking `.env.example` values with safe placeholders.
- Improved auth error messaging for Supabase email rate limits and unconfirmed email.
- Kept mobile-friendly controls stable while preserving the simplified journey.

Phase 4 notes:

- `npm test` passed after the Phase 4 quality changes.
- `npm run build` passed after the Phase 4 quality changes.
- Verify setup instructions from a clean environment where practical.
- Stop after tests pass and report final status.

## Approval Gates

- After each phase, run `npm run build`.
- If Supabase/backend behavior changes, verify SQL, RLS, and RPC expectations before continuing.
- Stop after each phase and ask for user permission before moving to the next phase.
- Do not treat this document as implementation; it is the gatekeeper plan for implementation work.
