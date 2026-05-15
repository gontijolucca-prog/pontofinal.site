// approval-store.js — localStorage adapter for item approval state.
// Schema: { [itemId]: { status: 'pending'|'approved'|'rejected', note: '', updatedAt: ISOString } }

const KEY = 'cm-approval-v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('approval:changed', { detail: state }));
}

export const approvalStore = {
  get(id) {
    return read()[id] || { status: 'pending', note: '', updatedAt: null };
  },

  set(id, status, note = '') {
    const state = read();
    state[id] = { status, note, updatedAt: new Date().toISOString() };
    write(state);
  },

  all() {
    return read();
  },

  counts() {
    const state = read();
    const counts = { approved: 0, rejected: 0, pending: 0 };
    for (const id in state) {
      counts[state[id].status] = (counts[state[id].status] || 0) + 1;
    }
    return counts;
  },

  export() {
    return JSON.stringify(read(), null, 2);
  },

  import(json) {
    const data = JSON.parse(json);
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid format');
    write(data);
  },

  reset() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('approval:changed', { detail: {} }));
  },
};
