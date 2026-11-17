# Dalal shared workspace

Public group editing without sign-in, as requested. The browser uses only the
Supabase publishable key. Anyone with the site link can read and edit the board.

## One-time setup

Execute `supabase-setup.sql` in the SQL Editor of project
`vxwyzrgvopggoaxggtuy`. No database password or secret key belongs in this
repository. The site remains on GitHub Pages.

The SQL exposes read access to three specific workspace documents. Writes run
through a function that checks the expected revision atomically. Every change is
merged against the latest document; changes to different tasks, places, and
fields can merge, while incompatible edits to one field remain local with a
visible conflict. Polling refreshes other clients about every four seconds while
the tab is visible. Dialogs defer incoming changes until they close.

Existing per-browser work is backed up locally before cloud hydration. Export a
complete backup on each device, then use the explicit button to merge its earlier
local work. Incompatible changes are never silently resolved. Pending edits are
persisted across reloads and retried after reconnection. The status bar is the
authority for whether a save has reached Supabase.

## Verification

Run `node tests/merge.test.cjs` and `node tests/integration.test.cjs`. These
verify concurrent changes, deletions, place-field merging, hydration, revision
retries, offline recovery, and two clients against a mocked Supabase API.
Embedded page scripts were also checked for JavaScript syntax. Full browser
verification was unavailable in the execution environment. A live save
cannot pass until the SQL has been executed in Supabase.
