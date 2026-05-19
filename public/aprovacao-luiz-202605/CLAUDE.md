# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpcjp1oz_p3dh score=7.2 created=2026-05-19 source=observation complexity=simple -->
- Before writing a bulk-patch Python script to /tmp, run a targeted grep on the actual HTML structure (data-slide, h1, h2 markers) to confirm the DOM shape matches your script's assumptions — then edit the script if needed before executing
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1pf_uhdv score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When applying bulk changes across multiple HTML files, create a /tmp backup of all affected data files (items.json, captions.json) before executing the patch script
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1pm_k45b score=5.1 created=2026-05-19 source=observation complexity=simple -->
- When a task involves client-specific brand voice rules discovered mid-session, immediately create a dedicated memory file and a TaskCreate to record them before proceeding with content edits — never defer memory writes to after the edits
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1ps_mrzv score=5.9 created=2026-05-19 source=observation complexity=simple -->
- When HTML files may exist in multiple mirror locations (public/brands, content-machine/brands, aprovacao/brands), run a diff + find to map all copies before editing any single copy — then propagate changes via cp to all mirrors in one Bash call
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1pz_dozb score=5.7 created=2026-05-19 source=observation complexity=simple -->
- After a multi-file patch script runs, immediately verify data state with a python3 inline check (json.load + print key fields) in the same Bash call using echo separators — do not rely on script exit code alone
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1q5_znz4 score=7.2 created=2026-05-19 source=anti_pattern complexity=simple -->
- Do not write a /tmp patch script and execute it in the same Bash call without first inspecting the target HTML structure — always interpose a grep of the DOM between Write and Bash execute
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1qb_j7gn score=5.1 created=2026-05-19 source=anti_pattern complexity=simple -->
- Do not run multiple sequential python3 heredoc probes on the same JSON files to discover structure incrementally — batch all structure discovery (keys, formats, slide counts, photo fields) into a single python3 script in one Bash call
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjwqp4_ziqd score=5.9 created=2026-05-19 source=observation complexity=simple -->
- Before writing a Playwright/screenshot render script to /tmp, verify the runtime is available (playwright import check + chromium cache listing) in a single Bash call before writing any script
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjwqpi_9lyg score=5.4 created=2026-05-19 source=observation complexity=simple -->
- Before executing a render/screenshot script that depends on a local HTTP server, curl -sI the target URL first and confirm HTTP 200 in the same Bash call — only proceed if server is confirmed live
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjwqpq_o6xh score=5.4 created=2026-05-19 source=observation complexity=simple -->
- When exploring a JS component's image/asset URL construction, layer grep calls from broad field names (photo, bg, thumb, preview, src) to specific variable names (jpgUrl, shotJpg, _shots) — broad first, narrow second
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
