# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpbf8j0x_pt93 score=5.6 created=2026-05-18 source=observation complexity=simple -->
- After a git push, immediately start a polling loop against the GitHub Actions API using head_sha to confirm the correct commit's CI run reached a conclusive state before closing the task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe077jp_8i1x score=5.1 created=2026-05-20 source=observation complexity=simple -->
- After any functional change to a web app, bump the version atomically in all three locations: version.txt, js/config.js (APP_VERSION constant), and index.html (<meta name="app-version">). Do all three in one pass; never update only a subset.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe7sntm_u0a8 score=5.1 created=2026-05-20 source=observation complexity=simple -->
- Source credentials via `set -a; source <file>.env; set +a` immediately before every Supabase Bash call — env vars do not persist across separate Bash tool invocations.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z00_v8u3 score=5.1 created=2026-05-20 source=observation complexity=simple -->
- When monitoring a long-running VPS process, use a blocking `until ! pgrep -f <process>` loop via SSH rather than polling manually — avoids repeated tail calls and frees the session for parallel work.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z0h_2dqp score=5.1 created=2026-05-20 source=observation complexity=simple -->
- After producing and queuing content pieces, immediately update THEMES_ROSTER.md with strikethrough + [USADO <format> · <date> · queue] for every consumed theme — never leave the roster in an ambiguous used/unused state.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfigf7a_15tb score=5.4 created=2026-05-21 source=observation complexity=simple -->
- When a new Instagram/Meta API limitation is discovered empirically (e.g., DELETE not permitted on feed posts), immediately write a dedicated memory file documenting the constraint before updating MEMORY.md index — never leave API limitations undocumented.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfigf7s_wxny score=5.1 created=2026-05-21 source=observation complexity=simple -->
- Always do a final state audit via SSH (crontab -l + queue file dumps) after any VPS scheduler reconfiguration to confirm the intended state is in effect before closing the task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfigf87_0hj5 score=5.1 created=2026-05-21 source=observation complexity=simple -->
- When disabling VPS scheduled jobs, combine crontab removal (crontab -r) with chmod -x on all wrapper scripts in a single SSH call — prevents partial disablement where cron is removed but scripts remain executable.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfigf8l_5zpe score=5.6 created=2026-05-21 source=anti_pattern complexity=simple -->
- Before attempting DELETE on Instagram Graph API objects, check whether the object type (feed post vs story vs media container) supports deletion — feed posts cannot be deleted via API; only stories and unpublished containers can. Do not waste API calls testing DELETE on feed posts.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfjbpgl_kghk score=5.6 created=2026-05-21 source=observation complexity=simple -->
- When researching a new external audio/media source, always start with the official API docs page before fetching the marketing/landing page — docs reveal auth requirements, endpoints, and licensing constraints that the landing page obscures.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
