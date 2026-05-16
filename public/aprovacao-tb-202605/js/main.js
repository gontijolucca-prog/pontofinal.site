// main.js — load items, render calendar + carrossel list + stories + reels galleries.

import { loadItems } from "./data-loader.js";
import { approvalStore } from "./stores/approval-store.js";

const state = { items: [] };

const els = {
  calendar:        () => document.getElementById("calendar"),
  carrosseisList:  () => document.getElementById("carrosseisList"),
  postsGallery:    () => document.getElementById("postsGallery"),
  reelsGallery:    () => document.getElementById("reelsGallery"),
  totalCount:      () => document.getElementById("totalCount"),
  carrosseisCount: () => document.getElementById("carrosseisCount"),
  postsCount:      () => document.getElementById("postsCount"),
  reelsCount:      () => document.getElementById("reelsCount"),
  approvedCount:   () => document.getElementById("approvedCount"),
  rejectedCount:   () => document.getElementById("rejectedCount"),
  pendingCount:    () => document.getElementById("pendingCount"),
  viewer:          () => document.getElementById("viewer"),
};

function sortBySchedule(a, b) {
  return (a.scheduled_for || "").localeCompare(b.scheduled_for || "");
}

function render() {
  els.calendar().setItems(state.items);

  const carrosseis = state.items.filter(i => i.format === "carrossel").sort(sortBySchedule);
  const posts      = state.items.filter(i => i.format === "story").sort(sortBySchedule);
  const reels      = state.items.filter(i => i.format === "reel").sort(sortBySchedule);

  const list = els.carrosseisList();
  list.innerHTML = "";
  carrosseis.forEach(it => {
    const row = document.createElement("carrossel-row");
    row.setItem(it);
    list.appendChild(row);
  });

  const pg = els.postsGallery();
  pg.innerHTML = "";
  posts.forEach(it => {
    const tile = document.createElement("post-tile");
    tile.setItem(it);
    pg.appendChild(tile);
  });

  const rg = els.reelsGallery();
  rg.innerHTML = "";
  reels.forEach(it => {
    const tile = document.createElement("reel-tile");
    tile.setItem(it);
    rg.appendChild(tile);
  });

  els.totalCount().textContent = String(state.items.length);
  els.carrosseisCount().textContent = String(carrosseis.length);
  els.postsCount().textContent = String(posts.length);
  els.reelsCount().textContent = String(reels.length);

  updateCounts();
}

function findItem(id) { return state.items.find(it => it.id === id); }

function bindOpen() {
  document.addEventListener("item:open", e => {
    const it = findItem(e.detail.id);
    if (it) els.viewer().open(it);
  });
  document.addEventListener("calendar:item-click", e => {
    const it = findItem(e.detail.id);
    if (it) els.viewer().open(it);
  });
}

function updateCounts() {
  const counts = approvalStore.counts();
  const total = state.items.length;
  els.approvedCount().textContent = String(counts.approved || 0);
  els.rejectedCount().textContent = String(counts.rejected || 0);
  els.pendingCount().textContent  = String(total - (counts.approved || 0) - (counts.rejected || 0));
}

function manageLoader() {
  const loader = document.getElementById("loader");
  const fill   = document.getElementById("loaderFill");
  const hint   = document.getElementById("loaderHint");
  if (!loader) return;

  const start = performance.now();
  const MIN_VISIBLE_MS = 1200;   // never flash & disappear
  const PER_IFRAME_MS  = 18000;  // give each iframe up to 18s before we count it
  const HARD_CAP_MS    = 30000;  // absolute ceiling so user isn't stuck forever
  const POST_LOAD_PAINT_MS = 400; // wait for content to actually paint after load fires

  // Catch every iframe that gets rendered into the DOM.
  const iframes = Array.from(document.querySelectorAll("iframe"));
  const total = iframes.length;
  let done = 0;
  let hidden = false;

  const hideNow = () => {
    if (hidden) return;
    hidden = true;
    // Tiny delay so the user sees the bar reach 100% before fade.
    setTimeout(() => loader.setAttribute("aria-hidden", "true"), 220);
  };

  const tryHide = () => {
    if (hidden) return;
    if (done < total) return;
    const elapsed = performance.now() - start;
    if (elapsed >= MIN_VISIBLE_MS) {
      hideNow();
    } else {
      setTimeout(tryHide, MIN_VISIBLE_MS - elapsed + 20);
    }
  };

  const update = () => {
    const pct = total === 0 ? 1 : done / total;
    fill.style.transform = `scaleX(${pct})`;
    hint.textContent = `${done} / ${total}`;
    tryHide();
  };

  if (total === 0) {
    fill.style.transform = "scaleX(1)";
    setTimeout(() => loader.setAttribute("aria-hidden", "true"), MIN_VISIBLE_MS);
    return;
  }

  update();

  iframes.forEach((f) => {
    let ticked = false;
    const tick = () => {
      if (ticked) return;
      ticked = true;
      done += 1;
      update();
    };

    // Wait for the iframe's window load (covers its images + fonts), then
    // wait one paint cycle so the content is actually on the screen.
    const onLoad = () => {
      // The iframe document is now done. Wait for its inner window load too
      // (catches images/fonts inside the carousel/story HTML).
      try {
        const w = f.contentWindow;
        const inner = () => requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(tick, POST_LOAD_PAINT_MS))
        );
        if (w && w.document && w.document.readyState === "complete") {
          inner();
        } else if (w) {
          w.addEventListener("load", inner, { once: true });
        } else {
          inner();
        }
      } catch {
        // Cross-origin or similar — best effort.
        setTimeout(tick, POST_LOAD_PAINT_MS);
      }
    };

    if (f.contentDocument && f.contentDocument.readyState === "complete") {
      onLoad();
    } else {
      f.addEventListener("load",  onLoad, { once: true });
      f.addEventListener("error", tick,   { once: true });
    }

    // Per-iframe safety net.
    setTimeout(tick, PER_IFRAME_MS);
  });

  // Absolute ceiling.
  setTimeout(hideNow, HARD_CAP_MS);
}

async function init() {
  state.items = await loadItems();
  bindOpen();
  window.addEventListener("approval:changed", updateCounts);
  render();
  // Wait one frame for the components to mount their iframes, then watch them.
  requestAnimationFrame(() => requestAnimationFrame(manageLoader));
}

init();
