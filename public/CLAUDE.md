# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpabhq56_52t5 score=5.3 created=2026-05-17 source=observation complexity=simple -->
- Before opening a local preview server, first check if port 8765 is already serving with a curl health-check; only start a new python3 http.server if the port is not responding.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpabhq5j_35bh score=5.4 created=2026-05-17 source=observation complexity=simple -->
- When investigating a static HTML file, combine git log, git diff, grep -c for key component markers, and a live curl -sI HEAD check in a single pipeline to get a complete picture before making any changes.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpabhq5p_7j62 score=6.9 created=2026-05-17 source=observation complexity=simple -->
- After starting a background local server with nohup, always follow immediately with `sleep 1 && curl` to confirm the server is accepting connections before opening the browser.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpabhq5v_1t6e score=5.6 created=2026-05-17 source=observation complexity=simple -->
- When auditing an HTML file for component presence, use `grep -c` with alternation for a count summary first, then `grep -E` with `head -5` for a sample of matching lines — count before content.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5c9_li9i score=5.6 created=2026-05-18 source=observation complexity=simple -->
- When regenerating voice assets, chain rm of old files, generation script, and HTML rebuild in a single Bash call — avoids stale audio mixing and ensures the preview reflects the latest pipeline run atomically.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5en_vdp8 score=5.9 created=2026-05-18 source=observation complexity=simple -->
- After committing regenerated assets, immediately attempt to open the local preview — do not defer the server-start and browser-open to a separate session step.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5f9_q8v7 score=6.5 created=2026-05-18 source=observation complexity=simple -->
- When a local HTTP server fails to respond after nohup start, use `lsof -ti :<port> | xargs kill -9` (not pgrep/xargs kill) to guarantee port release before retrying — pgrep pattern-match kills can leave bound sockets open.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5fj_1rfa score=6.5 created=2026-05-18 source=observation complexity=simple -->
- After a server restart resolves a connectivity issue, immediately verify the served content (not just HTTP status) with a targeted curl + grep — confirms routing is correct, not just that the port is open.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5fp_uqac score=5.9 created=2026-05-18 source=anti_pattern complexity=simple -->
- Do not use `pgrep -f | xargs kill` to free a bound TCP port — it matches process names but does not guarantee the socket is released. Use `lsof -ti :<port> | xargs kill -9` instead when a port must be forcibly cleared.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpazf5fz_rvlg score=5.9 created=2026-05-18 source=anti_pattern complexity=simple -->
- Do not add `sleep` before a `curl` health-check without first confirming the previous server process is fully terminated — overlapping processes can cause the new server to fail silently on bind.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
