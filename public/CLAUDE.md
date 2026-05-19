# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpabhq5v_1t6e score=5.9 created=2026-05-17 source=observation complexity=simple -->
- When auditing an HTML file for component presence, use `grep -c` with alternation for a count summary first, then `grep -E` with `head -5` for a sample of matching lines — count before content.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5c9_li9i score=5.1 created=2026-05-18 source=observation complexity=simple -->
- When regenerating voice assets, chain rm of old files, generation script, and HTML rebuild in a single Bash call — avoids stale audio mixing and ensures the preview reflects the latest pipeline run atomically.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcilfxc_fpdu score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When auditing voice/copy rules across multiple HTML files, run a broad grep with alternation first to surface all violation categories in one pass, then run a narrower targeted grep per category to get exact file:line hits
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcilfxq_9131 score=5.5 created=2026-05-19 source=observation complexity=simple -->
- After writing a Python script to /tmp, immediately execute it with `python3 /tmp/<script>.py 2>&1 | head -N` in the same session to verify it runs without error before treating the fix as applied
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcilfxz_veqt score=5.5 created=2026-05-19 source=observation complexity=simple -->
- After a bulk text-replacement script runs, spot-check a specific output file with a targeted grep (e.g., `grep 'title>' file.html`) to confirm the script mutated the correct file and the expected content is present
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcilfy7_ltx2 score=5.6 created=2026-05-19 source=observation complexity=simple -->
- Always Read a sync/deploy script before editing it, even when the edit target is a /tmp file you wrote earlier in the same session — file state may have changed between Write and Edit
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcilfye_tgvn score=5.5 created=2026-05-19 source=anti_pattern complexity=simple -->
- Do not truncate grep patterns mid-expression in a Bash call — a cut-off alternation (e.g., `|\bVestes` with no closing group) will silently match nothing or error; always verify the full pattern string before running
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcj4rny_q8ki score=5.3 created=2026-05-19 source=observation complexity=simple -->
- When locating a project directory whose path is uncertain, run a combined discovery command: check known parent dirs first (ls -d), then fall back to find with -maxdepth and -iname — all in a single Bash call to minimise round-trips
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcj4ro9_0abx score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When exploring an unfamiliar project folder, batch structure + config + data-size checks into one Bash call (ls, cat config, ls -la data/) before diving into any single file — avoids multiple sequential round-trips
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcj4rof_gapv score=5.3 created=2026-05-19 source=observation complexity=simple -->
- When a Python one-liner fails or is truncated mid-expression, immediately retry as a full multi-line heredoc python3 -c block in the next call — do not attempt partial fixes inline
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
