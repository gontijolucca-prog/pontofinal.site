# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpgtvxx8_rv97 score=5.4 created=2026-05-22 source=observation complexity=simple -->
- When a git push fails due to diverged history, stash user-unrelated unstaged changes with a dated label (e.g., 'user-work-pause-DDMMM'), then pull --rebase, then pop stash — all in one Bash call.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgtvxxr_qw76 score=6 created=2026-05-22 source=observation complexity=simple -->
- After scaffolding or deploying a new worker/bot project, immediately write dedicated memory files (one per logical layer) and update the MEMORY.md index in the same session — do not defer memory writes.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgtvxyq_hpzd score=7.3 created=2026-05-22 source=observation complexity=simple -->
- Generate security tokens with a human-readable prefix (e.g., 'pf-maria-') + secrets.token_urlsafe(), write to a dedicated file under ~/.config/credentials/ with chmod 600 immediately after generation — all in one command.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgxhydu_03vk score=5.1 created=2026-05-22 source=observation complexity=simple -->
- When waiting for a React/SPA to finish loading, poll document.body.innerText.length in a bounded loop (e.g. 15 iterations × 2s sleep) and break early once content exceeds ~1000 chars — never use a fixed sleep.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpgxhyge_sf7t score=5.1 created=2026-05-22 source=anti_pattern complexity=simple -->
- Never assume querySelectorAll('[role=switch]')[0] targets the intended toggle — always screenshot first to confirm which visible switch maps to the target action before clicking.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mphby0f2_k1rs score=6.3 created=2026-05-22 source=observation complexity=simple -->
- Before editing a Cloudflare Worker source file, grep for the target function/endpoint with line numbers first, then Read the full file — never Edit blindly from grep context alone.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mphby0fq_a19r score=6.9 created=2026-05-22 source=observation complexity=simple -->
- After deploying a Cloudflare Worker fix, immediately kill any existing wrangler tail process, truncate the log file, and restart tail with a versioned log name (e.g. /tmp/tail-v4.log) before scheduling a wakeup — never reuse a stale tail log across deploys.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mphby0g9_hsf3 score=6.9 created=2026-05-22 source=observation complexity=simple -->
- When diagnosing a Cloudflare Worker integration failure, cross-check the wrangler tail log (POST count, status codes, last N lines) AND the downstream database (Supabase REST query) in the same diagnostic batch before touching source code.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mphby0gs_9jec score=5.6 created=2026-05-22 source=observation complexity=simple -->
- After deploying a worker fix and resetting the tail log, schedule a bounded wakeup (≤120s) with a pre-written verification script embedded in the prompt — do not manually re-check; let the wakeup carry the exact commands.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mphc5s75_g9eq score=6.5 created=2026-05-22 source=observation complexity=simple -->
- When verifying an Instagram/external API token before deploying a worker fix, make a lightweight identity call (e.g. /me?fields=id,username) AND a messaging-capability call in the same batch — confirm both identity and permission scope before restarting the worker.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
