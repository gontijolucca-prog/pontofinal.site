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

  // Catch every iframe that gets rendered into the DOM.
  const iframes = Array.from(document.querySelectorAll("iframe"));
  const total = iframes.length;
  let done = 0;

  const update = () => {
    const pct = total === 0 ? 1 : done / total;
    fill.style.transform = `scaleX(${pct})`;
    hint.textContent = `${done} / ${total}`;
    if (done >= total) {
      // Tiny delay so the user sees the bar reach the end.
      setTimeout(() => loader.setAttribute("aria-hidden", "true"), 150);
    }
  };

  if (total === 0) { update(); return; }
  update();

  iframes.forEach((f) => {
    const tick = () => { done += 1; update(); };
    if (f.contentDocument && f.contentDocument.readyState === "complete") {
      tick();
    } else {
      f.addEventListener("load",  tick, { once: true });
      f.addEventListener("error", tick, { once: true });
    }
  });

  // Hard cap — never block the user longer than 10s even if some iframe never resolves.
  setTimeout(() => loader.setAttribute("aria-hidden", "true"), 10000);
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
