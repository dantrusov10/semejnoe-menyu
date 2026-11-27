/** Focus trap + Escape + aria wiring for .sk-modal dialogs */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

let escapeBound = false;
const stack = [];

function focusables(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

function onKeydown(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    e.preventDefault();
    top.close();
    return;
  }
  if (e.key !== "Tab") return;
  const nodes = focusables(top.el);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function ensureEscape() {
  if (escapeBound) return;
  document.addEventListener("keydown", onKeydown);
  escapeBound = true;
}

/**
 * Open modal with a11y: labelledby, focus trap, restore focus on close.
 * @param {HTMLElement} el modal root (.sk-modal)
 * @param {{ titleId?: string, close?: () => void }} opts
 */
export function openSkModal(el, opts = {}) {
  if (!el) return;
  ensureEscape();
  const already = stack.find((s) => s.el === el);
  const prev = already?.prev || document.activeElement;
  const titleId = opts.titleId || el.querySelector("h2")?.id;
  if (titleId) el.setAttribute("aria-labelledby", titleId);
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.classList.add("show");
  const entry = {
    el,
    prev,
    close: () => {
      if (typeof opts.close === "function") opts.close();
      else closeSkModal(el);
    },
  };
  if (already) {
    const idx = stack.indexOf(already);
    stack[idx] = entry;
  } else {
    stack.push(entry);
  }
  requestAnimationFrame(() => {
    const nodes = focusables(el);
    const prefer = el.querySelector(".sk-modal-close") || nodes[0];
    prefer?.focus?.();
  });
}

export function closeSkModal(el) {
  if (!el) return;
  const idx = stack.findIndex((s) => s.el === el);
  const entry = idx >= 0 ? stack.splice(idx, 1)[0] : null;
  el.classList.remove("show");
  const prev = entry?.prev;
  if (prev && typeof prev.focus === "function") {
    try {
      prev.focus();
    } catch {
      /* ignore */
    }
  }
}

export function isModalOpen(el) {
  return !!(el && el.classList.contains("show"));
}
