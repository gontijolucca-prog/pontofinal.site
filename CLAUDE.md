# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpbf8j0x_pt93 score=6.6 created=2026-05-18 source=observation complexity=simple -->
- After a git push, immediately start a polling loop against the GitHub Actions API using head_sha to confirm the correct commit's CI run reached a conclusive state before closing the task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe077jp_8i1x score=6.9 created=2026-05-20 source=observation complexity=simple -->
- After any functional change to a web app, bump the version atomically in all three locations: version.txt, js/config.js (APP_VERSION constant), and index.html (<meta name="app-version">). Do all three in one pass; never update only a subset.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpe7sntm_u0a8 score=5.4 created=2026-05-20 source=observation complexity=simple -->
- Source credentials via `set -a; source <file>.env; set +a` immediately before every Supabase (or any env-dependent) Bash call — env vars do not persist across separate Bash tool invocations.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z00_v8u3 score=5.1 created=2026-05-20 source=observation complexity=simple -->
- When monitoring a long-running VPS process, use a blocking `until ! pgrep -f <process>` loop via SSH rather than polling manually — avoids repeated tail calls and frees the session for parallel work.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mped0z0h_2dqp score=5.5 created=2026-05-20 source=observation complexity=simple -->
- After producing and queuing content pieces, immediately update THEMES_ROSTER.md with strikethrough + [USADO <format> · <date> · queue] for every consumed theme — never leave the roster in an ambiguous used/unused state.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mplcyorg_heh8 score=5.5 created=2026-05-25 source=observation complexity=simple -->
- When navigating to a Cloudflare dashboard page that may have a cookie/consent dialog, use mcp__claude-in-chrome__find to detect dialog buttons before attempting any interactive actions — this avoids clicking on blocked UI elements.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mplcyorz_m74k score=5.1 created=2026-05-25 source=observation complexity=simple -->
- When diagnosing a CI/CD deployment failure, navigate to the actual dashboard (Cloudflare Pages, GitHub Actions) to visually confirm the project exists and the account ID is correct before editing config files — do not assume secrets are correct.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mplcyosh_f83h score=5.4 created=2026-05-25 source=observation complexity=simple -->
- When fixing a deployment that fails due to a wrong account ID secret, hardcode the verified account ID directly into the workflow file rather than relying on a secret that may point to the wrong account.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mplcyosw_d029 score=5.5 created=2026-05-25 source=anti_pattern complexity=simple -->
- After navigating to a new page with claude-in-chrome, do not immediately call read_page or find — take a screenshot first to confirm the page loaded and is in the expected state, then decide whether interactive elements or a find query are appropriate.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpldkdxt_r5xe score=5.1 created=2026-05-25 source=observation complexity=simple -->
- When creating a Cloudflare API token via browser automation, probe environment prerequisites (PyNaCl availability, GitHub token admin scope) in a single Bash call before opening the browser — this determines whether automated secret injection is possible and avoids dead-end browser flows.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
