#!/usr/bin/env python3
"""
Publish the next reel from the queue to @pontofinal.site (Reel + Story).

Reads data/publish-history.json, takes queue[0], publishes Reel then Story
via Graph API v23, then updates the history file (committed by GH Actions).

Env:
  META_ACCESS_TOKEN  — long-lived IG/Meta token
  META_IG_USER_ID    — IG Business account id (default: pontofinal.site)
  PUBLIC_BASE_URL    — defaults to https://pontofinal.site
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HISTORY = ROOT / "data" / "publish-history.json"
CAPTIONS_DIR = ROOT / "data" / "captions"
REELS_DIR_REL = "brands/pontofinal_site/output/2026-05/static-reels"

GRAPH = "https://graph.instagram.com/v23.0"


def _refresh_token(current: str) -> str:
    """Refresh the IG long-lived token before each publish.

    IG long-lived tokens expire after 60 days. Refreshing on every publish (≤24h apart)
    keeps the token always 60 days from now — never within 1 day of expiry. The refreshed
    token is identical in capability; only the expiry resets. Safe to call as often as we
    want (IG allows refresh once per 24h per token; 10/day publish means at most 1 succeeds
    per 24h window — extras return the same token unchanged).
    """
    try:
        r = urllib.request.urlopen(
            f"https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={current}",
            timeout=15,
        )
        d = json.loads(r.read())
        new = d.get("access_token")
        if new:
            print(f"[token] refreshed (expires in {d.get('expires_in',0)//86400}d)")
            return new
    except Exception as e:
        print(f"[token] refresh failed (using current): {e}")
    return current


TOKEN = _refresh_token(os.environ["META_ACCESS_TOKEN"])
IG_USER_ID = os.environ.get("META_IG_USER_ID", "17841439350962641")
BASE = os.environ.get("PUBLIC_BASE_URL", "https://pontofinal.site").rstrip("/")


def api(method: str, path: str, params: dict | None = None, data: dict | None = None) -> dict:
    url = f"{GRAPH}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, method=method, data=body)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", "replace")
        raise SystemExit(f"[api error] {method} {path} → {e.code}: {msg}")


def wait_finished(container_id: str, timeout: int = 600) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = api("GET", f"/{container_id}", params={"fields": "status_code,status", "access_token": TOKEN})
        sc = r.get("status_code")
        print(f"  status: {sc}")
        if sc == "FINISHED":
            return
        if sc == "ERROR":
            raise SystemExit(f"  container {container_id} failed: {r}")
        time.sleep(8)
    raise SystemExit(f"  container {container_id} timeout after {timeout}s")


def publish_reel(video_url: str, cover_url: str, caption: str) -> str:
    print(f"[reel] container...")
    c = api("POST", f"/{IG_USER_ID}/media", data={
        "media_type": "REELS",
        "video_url": video_url,
        "cover_url": cover_url,
        "caption": caption,
        "share_to_feed": "true",
        "access_token": TOKEN,
    })
    cid = c["id"]
    print(f"[reel] container={cid}")
    wait_finished(cid)
    r = api("POST", f"/{IG_USER_ID}/media_publish", data={"creation_id": cid, "access_token": TOKEN})
    print(f"[reel] published id={r.get('id')}")
    return r["id"]


def publish_story(video_url: str) -> str:
    print(f"[story] container...")
    c = api("POST", f"/{IG_USER_ID}/media", data={
        "media_type": "STORIES",
        "video_url": video_url,
        "access_token": TOKEN,
    })
    cid = c["id"]
    print(f"[story] container={cid}")
    wait_finished(cid)
    r = api("POST", f"/{IG_USER_ID}/media_publish", data={"creation_id": cid, "access_token": TOKEN})
    print(f"[story] published id={r.get('id')}")
    return r["id"]


def load_caption(slug: str) -> str:
    p = CAPTIONS_DIR / f"{slug}.txt"
    if not p.exists():
        raise SystemExit(f"[fatal] missing caption: {p}")
    return p.read_text("utf-8").strip()


def main() -> None:
    if not HISTORY.exists():
        raise SystemExit(f"[fatal] missing history: {HISTORY}")
    h = json.loads(HISTORY.read_text("utf-8"))
    queue = h.get("queue", [])
    if not queue:
        print("[done] queue empty — banco vazio. Gerar mais reels.")
        return

    slug = queue[0]
    caption = load_caption(slug)
    video_url = f"{BASE}/{REELS_DIR_REL}/{slug}.mp4"
    cover_url = f"{BASE}/{REELS_DIR_REL}/{slug}-cover.jpg"

    print(f"[next] slug={slug}")
    print(f"[next] video={video_url}")
    print(f"[next] cover={cover_url}")

    reel_id = publish_reel(video_url, cover_url, caption)
    time.sleep(5)
    try:
        story_id = publish_story(video_url)
    except SystemExit as e:
        print(f"[story] failed but reel published. err={e}")
        story_id = None

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    h["published"].append({
        "slug": slug,
        "reel_at": now,
        "reel_id": reel_id,
        "story_at": now if story_id else None,
        "story_id": story_id,
    })
    h["queue"] = queue[1:]
    HISTORY.write_text(json.dumps(h, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"[done] {slug} → reel={reel_id} story={story_id}")
    print(f"[done] queue remaining: {len(h['queue'])}")

    # Idempotency safeguard: commit publish-history.json via Contents API directly,
    # so if the workflow's subsequent `git push` step fails, the queue state is still
    # advanced on main. Prevents the next cron from republishing the same slug.
    gh_token = os.environ.get("GITHUB_TOKEN")
    gh_repo = os.environ.get("GITHUB_REPOSITORY")
    if gh_token and gh_repo:
        try:
            import base64
            api_base = f"https://api.github.com/repos/{gh_repo}"
            # GET current SHA
            req = urllib.request.Request(
                f"{api_base}/contents/data/publish-history.json?ref=main",
                headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/vnd.github+json"},
            )
            cur_sha = json.loads(urllib.request.urlopen(req, timeout=20).read())["sha"]
            # PUT new content
            new_content = HISTORY.read_bytes()
            body = json.dumps({
                "message": f"publish: {slug} → reel={reel_id} story={story_id}",
                "content": base64.b64encode(new_content).decode("ascii"),
                "sha": cur_sha,
                "branch": "main",
                "committer": {"name": "pontofinal-publish-bot", "email": "bot@pontofinal.site"},
            }).encode()
            req = urllib.request.Request(
                f"{api_base}/contents/data/publish-history.json",
                data=body, method="PUT",
                headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=20)
            print(f"[commit] history updated on main via Contents API")
        except Exception as e:
            print(f"[commit] Contents API push failed: {e} — workflow git step will retry")


if __name__ == "__main__":
    main()
