# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mp7dduuo_5xak score=5.8 created=2026-05-15 source=observation complexity=simple -->
- When restoring a brand from a _legacy folder, immediately delete its stale output/ directory after moving it to active brands/ — legacy outputs are stale and will pollute new generation runs.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mp7dduuq_08ux score=5.7 created=2026-05-15 source=observation complexity=simple -->
- Before deploying a static site folder, run `git status --short` and `du -sh` on the new directories to confirm the expected files are staged and sizes are reasonable.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa2qahc_go0f score=5.4 created=2026-05-17 source=observation complexity=simple -->
- Before running Playwright or any live-URL test against a GitHub Pages deploy, poll the target asset URL in a curl loop until the expected content string appears — never fire visual tests against a CDN that may not have propagated yet.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa2qaht_uf25 score=5.4 created=2026-05-17 source=observation complexity=simple -->
- After a deployment session, write separate focused memory files per concern (e.g., one for credentials/config references, one for OS-level workarounds, one for project roadmap) and then update MEMORY.md index — never bundle unrelated layers into one file.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa2qai9_q7b3 score=5.8 created=2026-05-17 source=observation complexity=simple -->
- After a deployment completes, clean up all temp scripts and screenshot files with a single batched rm command before closing the session.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa2qail_3bhe score=5.2 created=2026-05-17 source=anti_pattern complexity=simple -->
- When a file operation (rm, write, copy) fails silently or with permission errors, immediately query the macOS TCC database (`sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db`) to check Full Disk Access grants before retrying the same command or trying alternative approaches (chflags, AppleScript Finder, etc.).
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa3g3q9_j90q score=5.9 created=2026-05-17 source=observation complexity=simple -->
- Before creating any data-population or build tasks, always create a dedicated credentials-handling task first and sequence it as the first dependency in the task chain.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa3g3qf_cg72 score=5 created=2026-05-17 source=observation complexity=simple -->
- When planning a multi-step feature (populate → verify → design → build → deploy), create all TaskCreate entries in a single batch before marking any task in_progress.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa3g3qj_d7vr score=5.9 created=2026-05-17 source=observation complexity=simple -->
- When building a dashboard backed by a new database table, decompose into exactly these sequential milestones: credentials → seed script → verify row counts → design architecture → build components → compose page → deploy.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa3g3qn_wpt9 score=5 created=2026-05-17 source=observation complexity=simple -->
- After a planning AskUserQuestion where the user selects an option, immediately decompose the chosen option into granular TaskCreate entries covering the full scope before starting any individual task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
