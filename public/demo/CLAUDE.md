# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpw4nn65_skrw score=5.9 created=2026-06-02 source=observation complexity=simple -->
- After bulk HTML theme replacements, run a residual-color grep (grep -lc '<old_hex>\|<old_hex2>' *.html) before committing to confirm zero files still carry the replaced values
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpw4nn6x_rd7s score=5.9 created=2026-06-02 source=observation complexity=simple -->
- After bulk HTML edits, verify font link replacement alongside color replacement in the same sanity pass — grep for both old font family name and old hex in one Bash call
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpw4nn7l_t88v score=5.9 created=2026-06-02 source=observation complexity=simple -->
- Before committing themed demos, capture headless Chrome screenshots of 2-3 representative files and visually inspect them — use `google-chrome --headless --screenshot` to /tmp then Read the PNGs
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpw4nn85_8jim score=5.9 created=2026-06-02 source=observation complexity=simple -->
- When auditing which files share a template color, use a for-loop with grep -oiE over CSS vars (--primary, --accent) and raw hex in separate passes — do count/presence first, then content sample
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpw4nn8p_hepy score=5.3 created=2026-06-02 source=observation complexity=simple -->
- After pushing themed/static HTML demos, poll the live URL with `until curl -s <url> | grep -qi '<new_hex>'` to confirm CDN propagation before closing the task
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpw4nn99_lazp score=5.9 created=2026-06-02 source=anti_pattern complexity=simple -->
- Do not attempt ToolSearch for Playwright MCP tools to screenshot local HTML files — fall back directly to headless Chrome CLI (`google-chrome --headless --screenshot`) which is always available on macOS
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
