/* Tab 4: the project as a self-playing promo film in seven chapters.
 * Context: scenes are HTML with CSS motion, timed by the chapter progress bars (Web Animations),
 * so play, pause and chapter jumps share one clock; the end of the last chapter opens the
 * project tab. The answer shown in chapter 5 is quoted from live_eval/results.json. |
 * Input: none | Output: scenes, chapter buttons, play/pause. */
import {el, icon, tr, onLang, reducedMotion} from "./dom.js";

const T = (de, en) => ({de, en});

const SCENES = [
  {chapter: T("Link", "Link"), ms: 6500, title: T("Ein Video. Eine Frage.", "One video. One question."),
    text: T("Einen YouTube-Link einfügen und in jeder Sprache fragen, getippt oder gesprochen.", "Paste a YouTube link and ask in any language, typed or spoken."),
    art: () => el("div", {class: "screen"}, [el("span", {class: "screen-play"}, icon("i-play")),
      el("span", {class: "screen-url"}, el("span", {class: "typed", text: "youtube.com/watch?v=CYvjC94jDu4"}))])},
  {chapter: T("Abschrift", "Transcript"), ms: 7000, title: T("Whisper hört zu.", "Whisper listens."),
    text: T("Der Ton wird Satz für Satz mitgeschrieben, jeder Satz bekommt seinen Zeitstempel.", "The audio is transcribed sentence by sentence, each with its timestamp."),
    art: () => el("div", {}, [el("div", {class: "wave"}, Array.from({length: 40}, (_, i) => el("i", {style: {"animation-delay": `${(i % 9) * -0.13}s`}}))),
      el("div", {class: "lines"}, [
        el("p", {}, [el("time", {text: "0:00"}), el("span", {text: tr(T("Abschnitt über Respekt", "Section on respect"))})]),
        el("p", {}, [el("time", {text: "2:15"}), el("span", {text: tr(T("Abschnitt über Ehrlichkeit", "Section on honesty"))})]),
        el("p", {}, [el("time", {text: "4:01"}), el("span", {text: tr(T("Abschnitt über gegenseitiges Interesse", "Section on mutual interest"))})]),
      ])])},
  {chapter: T("Wissen", "Knowledge"), ms: 6500, title: T("Zerlegt und abgelegt.", "Chunked and stored."),
    text: T("Die Abschrift wird in Stücke geschnitten und als Zahlenreihen gespeichert, damit sich nach Bedeutung suchen lässt.", "The transcript is cut into chunks and stored as vectors so it can be searched by meaning."),
    art: () => blocks([])},
  {chapter: T("Agent", "Agent"), ms: 7000, title: T("Der Agent findet die Stelle.", "The agent finds the moment."),
    text: T("Ein Agent mit sieben Werkzeugen entscheidet, was er braucht, und durchsucht nur das aktive Video.", "An agent with seven tools decides what it needs and searches only the active video."),
    art: () => blocks([4, 9, 13])},
  {chapter: T("Antwort", "Answer"), ms: 8500, title: T("Antwort in der Sprache der Frage.", "Answers in the language of the question."),
    text: T("Deutsche Frage an ein englisches Video: Die Antwort kommt auf Deutsch, mit der Stelle im Video.", "A German question to an English video: the answer comes in German, with the moment in the video."),
    art: () => el("div", {class: "chat"}, [
      el("p", {class: "bubble ask", text: "Was rät das Video zur Kommunikation in Beziehungen?"}),
      el("p", {class: "bubble say"}, [el("b", {text: "Ehrlichkeit: "}), document.createTextNode("Es ist entscheidend, ehrlich über deine Gefühle zu sein."),
        el("span", {class: "stamp"}, [icon("i-play"), document.createTextNode("2:15 – 4:01")])]),
    ])},
  {chapter: T("Messreihen", "Benchmarks"), ms: 7500, title: T("Gemessen statt geraten.", "Measured, not guessed."),
    text: T("Sieben Messreihen bestimmen jede Einstellung, ein echter Testlauf prüft das Ganze.", "Seven benchmarks set every option, a live run tests the whole."),
    art: () => el("div", {class: "bench-row"}, [
      T("Whisper-Varianten", "Whisper variants"), T("Bitrate", "Bitrate"), T("Einbettung", "Embedding"), T("Sprachmodelle", "Language models"),
      T("Mit und ohne Suche", "With and without search"), T("Stückgröße", "Chunk size"), T("Alle Kombinationen", "Every combination"), T("Echter Testlauf", "Live run"),
    ].map((label, n) => el("span", {style: {"--n": String(n)}, text: tr(label)})))},
  {chapter: T("Fähigkeiten", "Skills"), ms: 9000, title: T("Gebaut mit", "Built with"),
    text: T("Abschlussprojekt am Ironhack AI Engineering Bootcamp, April 2026. Daniel Hütte.", "Final project of the Ironhack AI Engineering Bootcamp, April 2026. Daniel Hütte."),
    art: () => el("div", {class: "skills"}, [
      "Python", "LangChain", "LangGraph", "OpenAI Whisper", "ChromaDB", T("Retrieval-Augmented Generation", "Retrieval-augmented generation"),
      T("Agent mit Werkzeugen", "Tool-using agent"), "Gradio", "LangSmith", "Hugging Face", T("Pandas und Seaborn", "Pandas and Seaborn"), T("Sprachmodell als Prüfer", "Language model as judge"),
    ].map((label, n) => el("span", {style: {"--n": String(n)}, text: tr(label)})))},
];

let index = 0;
let playing = false;
let progress = null;
let started = false;

function blocks(hits) {
  return el("div", {class: "blocks"}, Array.from({length: 18}, (_, n) => el("i", {class: hits.includes(n) ? "is-hit" : null, style: {"--n": String(n)}})));
}

function render() {
  const stage = document.getElementById("film-stage");
  stage.replaceChildren(...SCENES.map((scene, n) => el("section", {class: "scene", "aria-hidden": "true", "aria-label": `${n + 1} / ${SCENES.length}`}, [
    el("div", {class: "scene-art", "aria-hidden": "true"}, scene.art()),
    el("div", {class: "scene-caption"}, [el("p", {class: "scene-chapter", text: `${n + 1} / ${SCENES.length}, ${tr(scene.chapter)}`}),
      el("h2", {class: "scene-title", text: tr(scene.title)}), el("p", {class: "scene-text", text: tr(scene.text)})]),
  ])));
  document.getElementById("film-chapters").replaceChildren(...SCENES.map((scene, n) => el("li", {},
    el("button", {type: "button", class: "chapter", "aria-label": `${tr({de: "Kapitel", en: "Chapter"})} ${n + 1}: ${tr(scene.chapter)}`}, [
      el("span", {class: "chapter-bar"}, el("i")), el("span", {class: "chapter-name", text: tr(scene.chapter)})]))));
  document.querySelectorAll(".chapter").forEach((button, n) => button.addEventListener("click", () => go(n, playing)));
  go(index, playing);
}

function go(n, autoplay) {
  index = n;
  progress?.cancel();
  document.querySelectorAll(".scene").forEach((scene, i) => {
    scene.classList.toggle("is-on", i === n);
    scene.setAttribute("aria-hidden", String(i !== n));
  });
  document.querySelectorAll(".chapter").forEach((button, i) => {
    button.classList.toggle("is-done", i < n);
    if (i === n) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
  });
  const bar = document.querySelectorAll(".chapter-bar i")[n];
  progress = bar.animate([{transform: "scaleX(0)"}, {transform: "scaleX(1)"}], {duration: SCENES[n].ms, fill: "forwards"});
  progress.onfinish = () => (n + 1 < SCENES.length ? go(n + 1, true) : finish());
  setPlaying(autoplay);
}

/* A film that has played to the end hands over to the project tab through the tab link, so the
 * address, history and tab bar follow; it waits on its first chapter and starts again by itself
 * on the next visit. Under reduced motion it only stops. */
function finish() {
  const tab = document.getElementById("tab-projekt");
  if (!tab || reducedMotion()) { setPlaying(false); return; }
  go(0, false);
  started = false;
  tab.click();
}

function setPlaying(value) {
  playing = value;
  if (progress) value ? progress.play() : progress.pause();
  const button = document.getElementById("film-play");
  button.setAttribute("aria-pressed", String(value));
  document.getElementById("film-play-label").textContent = tr(value ? {de: "Anhalten", en: "Pause"} : {de: "Abspielen", en: "Play"});
}

export function mount() {
  render();
  document.getElementById("film-play").addEventListener("click", () => {
    if (!playing && index === SCENES.length - 1 && progress?.playState === "finished") go(0, true);
    else setPlaying(!playing);
  });
  onLang(render);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
}

/* The film starts by itself on the first visit of the tab; with reduced motion it waits for a click. */
export function resume() {
  if (!started && !reducedMotion()) { started = true; setPlaying(true); }
}

export function pause() { setPlaying(false); }
