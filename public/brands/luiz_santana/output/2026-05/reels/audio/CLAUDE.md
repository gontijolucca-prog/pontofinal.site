# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpm1uj0h_uzi1 score=5.2 created=2026-05-26 source=observation complexity=simple -->
- After editing a Python script, immediately validate syntax with `python3 -c "import ast; ast.parse(open('file.py').read())"` before executing it
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm1uj12_zffh score=5.6 created=2026-05-26 source=observation complexity=simple -->
- Read the target file before issuing any Edit calls — never edit blind
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm1uj1i_o1o7 score=5.6 created=2026-05-26 source=observation complexity=simple -->
- When generating multiple audio speed variants with ffmpeg atempo, name output files with the semantic label (e.g. slow93, slow88) rather than the parameter name (speed092, speed088) to make intent clear
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm1uj1z_530a score=5.2 created=2026-05-26 source=observation complexity=simple -->
- After generating multiple audio variants, clean up rejected/erratic takes with rm before sending the final files to the user — never deliver alongside discarded artifacts
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpm1uj2e_vdkk score=5.2 created=2026-05-26 source=observation complexity=simple -->
- When sending audio variants to the user, include in the caption: the source take name, the speed percentage change, and a plain-language description of the difference between options
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
