# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpfus8k4_ug04 score=5.9 created=2026-05-21 source=observation complexity=simple -->
- After downloading a generated audio file, verify it exists and inspect its metadata with ffprobe before sending it to the client
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfus8kf_gyl7 score=5 created=2026-05-21 source=observation complexity=simple -->
- After sending a media asset via WhatsApp, immediately follow with a text message explaining the asset's origin, cost, and next-step options — never send media silently
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfvu6v9_djb3 score=5.1 created=2026-05-21 source=observation complexity=simple -->
- When abandoning a slower/lower-quality model mid-session (e.g., Wan) in favor of a higher-fidelity one (e.g., Seedance 2.0), immediately update the active task description to reflect the model switch and credit cost so context is not lost
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm4w16q_g550 score=5.3 created=2026-05-26 source=observation complexity=simple -->
- When delivering a HeyGen video, include in the SendUserFile caption: version label, duration, key script changes, and production notes (avatar type, voice quality) — never send bare files
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm4w179_3wqb score=5.3 created=2026-05-26 source=observation complexity=simple -->
- Before downloading a HeyGen video, call mcp__heygen__get_video to confirm the render is complete and retrieve the final download URL — do not curl a stale or assumed URL
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
