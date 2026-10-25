/* Entry point: language switch, tab router and lazy loading of the heavier tabs.
 * Context: the four tabs are deep-linkable (#projekt, #organigramm, #benchmarks, #praesentation);
 * any other hash that names an element inside a tab opens that tab and scrolls to it, so the
 * old section links (#testlauf, #messreihen, #aufbau) keep working. | Input: location.hash,
 * ?lang= or the stored choice | Output: one visible tab panel, synced tab bar. */
import {setLang, onLang, lang} from "./dom.js";
import {renderProject} from "./projekt.js";

const TABS = ["projekt", "organigramm", "benchmarks", "praesentation"];
const LOADERS = {
  organigramm: () => import("./organigramm.js"),
  benchmarks: () => import("./benchmarks.js"),
  praesentation: () => import("./praesentation.js"),
};
const TITLES = {
  projekt: {de: "Projekt", en: "Project"},
  organigramm: {de: "Organigramm", en: "Organigram"},
  benchmarks: {de: "Benchmarks", en: "Benchmarks"},
  praesentation: {de: "Präsentation", en: "Presentation"},
};
const loaded = new Map();
let active = null;

function resolve(hash) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (TABS.includes(id)) return {tab: id, target: null};
  const target = id ? document.getElementById(id) : null;
  const panel = target?.closest(".panel");
  return panel ? {tab: panel.id, target} : {tab: "projekt", target: null};
}

async function mount(tab) {
  if (!LOADERS[tab] || loaded.has(tab)) return loaded.get(tab);
  const module = LOADERS[tab]().then((m) => { m.mount(); return m; });
  loaded.set(tab, module);
  return module;
}

function show(tab, target) {
  const changed = tab !== active;
  for (const id of TABS) {
    const panel = document.getElementById(id);
    const tabLink = document.getElementById(`tab-${id}`);
    panel.hidden = id !== tab;
    tabLink.setAttribute("aria-selected", String(id === tab));
    tabLink.tabIndex = id === tab ? 0 : -1;
  }
  if (changed) {
    loaded.get(active)?.then((m) => m?.pause?.());
    const panel = document.getElementById(tab);
    panel.classList.remove("is-entering");
    void panel.offsetWidth;
    panel.classList.add("is-entering");
    active = tab;
    document.title = document.title.replace(/^(.*?)( \| .*)?$/, `$1 | ${TITLES[tab][lang()]}`);
  }
  mount(tab)?.then((m) => m?.resume?.());
  if (target) requestAnimationFrame(() => target.scrollIntoView({block: "start"}));
  else if (changed) scrollTo({top: 0});
}

function route() {
  const {tab, target} = resolve(location.hash);
  show(tab, target);
}

function wireTabBar() {
  const tabs = TABS.map((id) => document.getElementById(`tab-${id}`));
  document.querySelector(".dock-list").addEventListener("keydown", (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const step = {ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index}[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    history.pushState(null, "", next.getAttribute("href"));
    route();
    next.focus();
  });
}

function initLanguage() {
  let stored = null;
  try { stored = localStorage.getItem("lang"); } catch { stored = null; }
  const preferred = new URLSearchParams(location.search).get("lang") || stored
    || (navigator.language || "de").slice(0, 2);
  for (const button of document.querySelectorAll(".lang button")) {
    button.addEventListener("click", () => {
      setLang(button.dataset.lang);
      try { localStorage.setItem("lang", lang()); } catch { /* private mode: the choice lasts for this visit only */ }
    });
  }
  onLang((code) => {
    for (const button of document.querySelectorAll(".lang button")) {
      button.setAttribute("aria-pressed", String(button.dataset.lang === code));
    }
    if (active) document.title = document.title.replace(/ \| .*$/, ` | ${TITLES[active][code]}`);
  });
  setLang(preferred);
}

initLanguage();
wireTabBar();
addEventListener("hashchange", route);
route();
renderProject();
