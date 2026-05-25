# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpbf8j0x_pt93 score=6.4 created=2026-05-18 source=observation complexity=simple -->
- After a git push, immediately start a polling loop against the GitHub Actions API using head_sha to confirm the correct commit's CI run reached a conclusive state before closing the task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe077jp_8i1x score=5.4 created=2026-05-20 source=observation complexity=simple -->
- After any functional change to a web app, bump the version atomically in all three locations: version.txt, js/config.js (APP_VERSION constant), and index.html (<meta name="app-version">). Do all three in one pass; never update only a subset.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe7sntm_u0a8 score=5.4 created=2026-05-20 source=observation complexity=simple -->
- Source credentials via `set -a; source <file>.env; set +a` immediately before every Supabase (or any env-dependent) Bash call — env vars do not persist across separate Bash tool invocations.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z00_v8u3 score=5.1 created=2026-05-20 source=observation complexity=simple -->
- When monitoring a long-running VPS process, use a blocking `until ! pgrep -f <process>` loop via SSH rather than polling manually — avoids repeated tail calls and frees the session for parallel work.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z0h_2dqp score=5.8 created=2026-05-20 source=observation complexity=simple -->
- After producing and queuing content pieces, immediately update THEMES_ROSTER.md with strikethrough + [USADO <format> · <date> · queue] for every consumed theme — never leave the roster in an ambiguous used/unused state.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgukzok_8lhi score=5.4 created=2026-05-22 source=observation complexity=simple -->
- After every browser-harness action that changes page state, immediately capture_screenshot(path='/tmp/<context>.png') and Read the file to verify the change took effect before proceeding.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgukzpb_zux6 score=5.2 created=2026-05-22 source=observation complexity=simple -->
- When injecting content into a Monaco editor via browser-harness, use js() to call the Monaco global API directly rather than simulating keyboard input or clipboard paste.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgukzpy_l7yf score=5.6 created=2026-05-22 source=observation complexity=simple -->
- After running SQL via the Supabase dashboard UI, immediately verify table creation via the REST API (curl with apikey header, one request per table) rather than trusting the UI success state alone.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgukzqk_5rq8 score=5.1 created=2026-05-22 source=observation complexity=simple -->
- When a site presents a password re-entry dialog that blocks automation, activate Chrome via osascript, print a clear human instruction with expected wait time, then poll the dialog's DOM presence in a loop (5s intervals, bounded max) — do not block indefinitely.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgukzr5_essb score=5.2 created=2026-05-22 source=observation complexity=simple -->
- When matching UI buttons via js() querySelectorAll, use textContent.includes() for buttons with icon/shortcut suffixes (e.g. '⌘↵'), and textContent.trim() === exact string only for plain-text confirm buttons — combine offsetParent !== null to skip hidden duplicates.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
