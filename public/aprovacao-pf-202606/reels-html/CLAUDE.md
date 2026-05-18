# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpb4t0nh_ky5u score=5.3 created=2026-05-18 source=observation complexity=simple -->
- Before editing a reel template, Read the template file AND inspect existing output JSON files to understand current data shape — never edit blind
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0nu_3ncx score=5.9 created=2026-05-18 source=observation complexity=simple -->
- After editing a reel template, immediately regenerate output files with the generator script, then verify key patterns with grep -c across all output files before opening a browser preview
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0o1_pmxq score=5.9 created=2026-05-18 source=observation complexity=simple -->
- When adding a new audio asset (SFX, notif, beat), use ffprobe to check duration and bit_rate immediately after conversion — never assume ffmpeg output is correct without verifying
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0o7_yq29 score=5.3 created=2026-05-18 source=observation complexity=simple -->
- Before converting a system sound to mp3, use ffprobe to compare durations of all candidate files — then present options to the user with descriptions before committing to one
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0oe_0v37 score=5.9 created=2026-05-18 source=observation complexity=simple -->
- When exploring a content-machine brand directory, always inspect brands/<brand>/assets/, brands/<brand>/output/, and scripts/reels/ in a single compound command to map the full asset structure before any edit
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0ok_c5np score=5.9 created=2026-05-18 source=observation complexity=simple -->
- After template regeneration, verify new JS/CSS variables are present in output with grep -E on representative files before doing a live curl HTTP check — confirm content correctness before confirming availability
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0os_dvmm score=5.9 created=2026-05-18 source=anti_pattern complexity=simple -->
- Do not AskUserQuestion about SFX options before running ffprobe to gather durations — user cannot make an informed choice without knowing the actual sound properties
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4t0oz_30ht score=5.3 created=2026-05-18 source=anti_pattern complexity=simple -->
- Do not make multiple sequential Bash ls/find calls to map a directory tree — consolidate into one compound command with find -maxdepth and ls in a single Bash call to reduce round-trips
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
