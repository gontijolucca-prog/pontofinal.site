# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mp7dduuo_5xak score=5.8 created=2026-05-15 source=observation complexity=simple -->
- When restoring a brand from a _legacy folder, immediately delete its stale output/ directory after moving it to active brands/ — legacy outputs are stale and will pollute new generation runs.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa2qail_3bhe score=5.1 created=2026-05-17 source=anti_pattern complexity=simple -->
- When a file operation (rm, write, copy) fails silently or with permission errors, immediately query the macOS TCC database (`sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db`) to check Full Disk Access grants before retrying the same command or trying alternative approaches (chflags, AppleScript Finder, etc.).
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpa3g3q9_j90q score=5.1 created=2026-05-17 source=observation complexity=simple -->
- Before creating any data-population or build tasks, always create a dedicated credentials-handling task first and sequence it as the first dependency in the task chain.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpabokbc_spvx score=5.1 created=2026-05-17 source=observation complexity=simple -->
- Before selecting a background music track for a reel, audit available audio files with ffprobe to compare durations and md5sum to detect duplicates — never copy a file as 'beat.mp3' without verifying its properties first.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpb4506i_4i92 score=5.1 created=2026-05-18 source=observation complexity=simple -->
- When a local preview server may already be running on the expected port, always check with `lsof -i :<port>` and curl the port before starting a new server — only spin up a new server if the port is unoccupied or serving wrong content
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpbf8j0x_pt93 score=6.3 created=2026-05-18 source=observation complexity=simple -->
- After a git push, immediately start a polling loop against the GitHub Actions API using head_sha to confirm the correct commit's CI run reached a conclusive state before closing the task.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpckf8dk_wn5v score=5.9 created=2026-05-19 source=observation complexity=simple -->
- Before staging and committing multi-brand public/ changes, run `git status --short | awk '{print $2}' | sed 's|/[^/]*$||' | sort | uniq -c` to get a per-directory count of changed files and avoid accidentally including unrelated brand directories.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpckf8e1_bofw score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When a git push is rejected due to diverged remote, always run `git fetch origin` followed by `git log --oneline HEAD..origin/main` to inspect remote-only commits before attempting rebase — never pull blindly.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpckf8ec_ychj score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When a rebase hits merge conflicts on brand-partitioned directories, use a case-based shell loop (`case "$f" in public/aprovacao-luiz-202605/* )`) to apply `git checkout --theirs` or `--ours` per directory ownership rather than resolving conflicts file by file.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpckf8el_gj2c score=5.9 created=2026-05-19 source=observation complexity=simple -->
- Before stashing WIP to allow a clean rebase, use `git stash push -u -m '<descriptive-label>'` with the `-u` flag to include untracked files, ensuring nothing is silently left behind.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
