/* Shared helpers: element builder, number formatting, page language and the chart tooltip.
 * Context: every tab module renders from data and re-renders on a language switch. | Input: none
 * | Output: el, fmt, lang state with subscribers, tooltip wiring. */

const listeners = new Set();
let current = "de";

export const REPO = "https://github.com/DanielHuette/Multilingual_YouTube_Analyzer";
export const BLOB = `${REPO}/blob/main/`;

const dataCache = new Map();

export function lang() { return current; }

/** Fetch a JSON file once per visit; every tab shares the same promise. */
export function loadJson(path) {
  if (!dataCache.has(path)) dataCache.set(path, fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }));
  return dataCache.get(path);
}

export function setLang(code) {
  current = code === "en" ? "en" : "de";
  document.documentElement.lang = current;
  for (const listener of listeners) listener(current);
}

export function onLang(listener) { listeners.add(listener); }

/** Pick the text for the current language from a {de, en} pair or return a plain string. */
export function tr(value) {
  return typeof value === "string" ? value : value[current];
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "style") for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

export function icon(id, cls = "") {
  return svg("svg", {viewBox: "0 0 24 24", "aria-hidden": "true", class: cls}, svg("use", {href: `#${id}`}));
}

/** Format a number with fixed decimals in the page language. */
export function fmt(value, digits = 1) {
  return value.toLocaleString(current === "de" ? "de-DE" : "en-GB",
    {minimumFractionDigits: digits, maximumFractionDigits: digits});
}

export function usd(value, digits) {
  return current === "de" ? `${fmt(value, digits)} US-Dollar` : `$${fmt(value, digits)}`;
}

export function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* One tooltip for all charts: marks carry data-tip-title and data-tip (lines split by "|"). */
export function wireTooltips(root) {
  const tip = document.getElementById("tip");
  const show = (target, x, y) => {
    tip.replaceChildren(el("b", {text: target.dataset.tipTitle}),
      ...target.dataset.tip.split("|").map((line) => el("div", {text: line})));
    tip.hidden = false;
    const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(8, x - box.width / 2), innerWidth - box.width - 8)}px`;
    tip.style.top = `${y - box.height - 14 < 8 ? y + 18 : y - box.height - 14}px`;
  };
  const hide = () => { tip.hidden = true; };
  root.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-tip]");
    if (target) show(target, event.clientX, event.clientY);
  });
  root.addEventListener("pointermove", (event) => {
    const target = event.target.closest("[data-tip]");
    if (target) show(target, event.clientX, event.clientY); else hide();
  });
  root.addEventListener("pointerleave", hide);
  root.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-tip]");
    if (!target) return;
    const box = target.getBoundingClientRect();
    show(target, box.left + box.width / 2, box.top);
  });
  root.addEventListener("focusout", hide);
  addEventListener("scroll", hide, {passive: true});
}
