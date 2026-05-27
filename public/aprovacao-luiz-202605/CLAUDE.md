# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpcjp1pm_k45b score=5.1 created=2026-05-19 source=observation complexity=simple -->
- When a task involves client-specific brand voice rules discovered mid-session, immediately create a dedicated memory file and a TaskCreate to record them before proceeding with content edits — never defer memory writes to after the edits
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpcjp1ps_mrzv score=5.2 created=2026-05-19 source=observation complexity=simple -->
- When HTML files may exist in multiple mirror locations (public/brands, content-machine/brands, aprovacao/brands), run a diff + find to map all copies before editing any single copy — then propagate changes via cp to all mirrors in one Bash call
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfktsvw_ri9h score=5.4 created=2026-05-21 source=observation complexity=simple -->
- Always Read THEMES_ROSTER.md before editing it, then immediately mark consumed themes with strikethrough + [USADO <format> · <date>] in the same session
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfktsxb_vumr score=5.4 created=2026-05-21 source=observation complexity=simple -->
- When initiating the first download to a new directory, always mkdir -p the target path in the same Bash call — never assume the directory exists.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfktsxp_slds score=5.6 created=2026-05-21 source=observation complexity=simple -->
- Load the agent persona file (e.g., pontofinal-copywriter.md) via Read before spawning an Agent with that persona — ensures the prompt can reference confirmed file contents rather than assumed paths
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
