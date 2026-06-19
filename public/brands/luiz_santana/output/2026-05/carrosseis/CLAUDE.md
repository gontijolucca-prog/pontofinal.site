# CLAUDE.md

## Auto-learned Rules

<!-- claude-evolve:managed-start -->

<!-- claude-evolve:rule id=r_mpfinxnb_124k score=5.3 created=2026-05-21 source=observation complexity=simple -->
- When searching WhatsApp messages for content, issue multiple targeted keyword queries in parallel rather than a single broad query — use domain-specific terms (e.g., 'hook', 'slide', 'texto', 'primeira') to triangulate the relevant message.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfinxnv_vhwy score=5.9 created=2026-05-21 source=observation complexity=simple -->
- Before downloading WhatsApp media, verify the chat store directory exists and inspect its contents with ls -la to confirm available files and avoid blind download attempts.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfinxoa_sw0k score=5.3 created=2026-05-21 source=observation complexity=simple -->
- When transcribing or processing a downloaded media file, write the processing script to /tmp/ and execute it immediately — do not inline long processing logic in a Bash -c one-liner.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfinxop_075q score=5.9 created=2026-05-21 source=observation complexity=simple -->
- When extracting text from a .docx file without a library dependency, use Python's zipfile + regex strip on word/document.xml as a lightweight fallback — no need to install python-docx for simple text extraction.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:rule id=r_mpfinxp4_9o4f score=5.3 created=2026-05-21 source=anti_pattern complexity=simple -->
- When issuing multiple mcp__whatsapp__list_messages queries for the same chat, add a date filter (after:) from the first call — do not issue the first query without a date bound and then add it only in subsequent calls.
<!-- /claude-evolve:rule -->

<!-- claude-evolve:managed-end -->
