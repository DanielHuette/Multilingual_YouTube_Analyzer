/* Tab 2: the analyzer as an organigram of stations with animated data flow.
 * Context: stations, links and skills follow README.md, ARCHITECTURE.md, requirements.txt,
 * benchmark.ipynb and live_eval/run_live_eval.py; nothing here is measured, so no figures.
 * | Input: none | Output: station buttons in three lanes, SVG wires with moving lights, a detail
 * panel naming what happens at the selected station and which skills it applies. */
import {el, svg, tr, onLang, reducedMotion, BLOB} from "./dom.js";

const NODES = [
  {id: "live", row: 1, col: 1, auto: true, file: "live_eval/run_live_eval.py",
    title: {de: "Testlauf-Skript", en: "Live-run script"},
    sub: {de: "treibt das ganze Notebook", en: "drives the whole notebook"},
    text: {de: "Führt die Zellen des ausgelieferten Notebooks ohne Oberfläche aus: vier Videos aufnehmen, je Video acht Fragen aus den Untertiteln erzeugen, Zusatzfragen in anderer Sprache stellen und jede Antwort prüfen lassen. Alles landet in live_eval/results.json; scripts/build_web_data.py macht daraus die Daten dieser Seite.",
      en: "Runs the cells of the shipped notebook without the interface: take in four videos, generate eight questions per video from the captions, ask extra questions in another language and have every answer judged. Everything lands in live_eval/results.json; scripts/build_web_data.py turns it into the data of this page."},
    skills: {de: ["Python", "Automatischer Testlauf von vorne bis hinten", "Bewertung mit echten Videos"], en: ["Python", "Automated end-to-end run", "Evaluation on real videos"]}},
  {id: "bench", row: 1, col: 3, auto: true, file: "benchmark.ipynb",
    title: {de: "Messreihen-Notebook", en: "Benchmark notebook"},
    sub: {de: "sieben Messreihen, Ergebnis als Dateien", en: "seven benchmarks, results as files"},
    text: {de: "Vergleicht Whisper-Varianten, Bitraten, Einbettungsmodelle, Sprachmodelle, Antworten mit und ohne Suche, Zerlegungen und alle Kombinationen. Die Ergebnisse schreibt es als Dateien (chunk_recommendations.json, prices.json, winners.json, combo_table.csv) in einen Ordner, den das Frage-Notebook beim Start lädt. Stückgröße und Kostenanzeige kommen von dort, nicht aus Bauchgefühl.",
      en: "Compares Whisper variants, bitrates, embedding models, language models, answers with and without search, chunkings and every combination. It writes the results as files (chunk_recommendations.json, prices.json, winners.json, combo_table.csv) into a folder the Q&A notebook loads at start-up. Chunk size and the cost display come from there, not from gut feeling."},
    skills: {de: ["Pandas und NumPy", "Matplotlib und Seaborn", "Hugging Face (sentence-transformers)", "Messreihen und Bewertung"], en: ["Pandas and NumPy", "Matplotlib and Seaborn", "Hugging Face (sentence-transformers)", "Benchmarking and evaluation"]}},
  {id: "audio", row: 2, col: 1, file: "ARCHITECTURE.md",
    title: {de: "Link und Tonspur", en: "Link and audio"},
    sub: {de: "yt-dlp, 64 Kilobit je Sekunde", en: "yt-dlp, 64 kilobits per second"},
    text: {de: "yt-dlp lädt die Tonspur eines YouTube-Videos als m4a mit 64 Kilobit je Sekunde; Titel, Kanal und Dauer kommen mit. Die Bitrate ist aus Messreihe 2 abgeleitet.",
      en: "yt-dlp downloads the audio of a YouTube video as m4a at 64 kilobits per second, together with title, channel and duration. The bitrate follows from benchmark 2."},
    skills: {de: ["Python", "Herunterladen mit yt-dlp"], en: ["Python", "Downloading with yt-dlp"]}},
  {id: "whisper", row: 2, col: 2, file: "ARCHITECTURE.md",
    title: {de: "Abschrift", en: "Transcription"},
    sub: {de: "Whisper mit Zeitstempeln", en: "Whisper with timestamps"},
    text: {de: "Whisper schreibt den Ton mit, über die Programmierschnittstelle von OpenAI (whisper-1, Voreinstellung) oder auf dem eigenen Rechner (tiny bis large-v3), mit Zeitstempel je Satz. jiwer misst die Wortfehlerrate gegen die YouTube-Untertitel.",
      en: "Whisper transcribes the audio, through the OpenAI API (whisper-1, the default) or on your own machine (tiny to large-v3), with a timestamp per segment. jiwer measures the word error rate against the YouTube captions."},
    skills: {de: ["Spracherkennung mit OpenAI Whisper", "Sprachverarbeitung", "Wortfehlerrate mit jiwer"], en: ["Speech recognition with OpenAI Whisper", "Natural language processing", "Word error rate with jiwer"]}},
  {id: "chunk", row: 2, col: 3, file: "ARCHITECTURE.md",
    title: {de: "Zerlegen", en: "Chunking"},
    sub: {de: "Stückgröße nach Videolänge", en: "chunk size by video length"},
    text: {de: "tiktoken und der Textzerleger von LangChain schneiden die Abschrift in Stücke. Größe und Überlappung wählt get_chunk_config() nach Videolänge und Whisper-Variante aus chunk_recommendations.json. Fehlt die Datei, bricht der Start ab, statt still mit einem Ersatzwert weiterzumachen.",
      en: "tiktoken and the LangChain text splitter cut the transcript into chunks. get_chunk_config() picks size and overlap by video length and Whisper variant from chunk_recommendations.json. If the file is missing, start-up stops instead of silently carrying on with a fallback."},
    skills: {de: ["LangChain", "Einstellung aus Messdaten"], en: ["LangChain", "Settings derived from measurements"]}},
  {id: "store", row: 2, col: 4, file: "ARCHITECTURE.md",
    title: {de: "Wissensspeicher", en: "Knowledge store"},
    sub: {de: "Einbettung in ChromaDB", en: "embeddings in ChromaDB"},
    text: {de: "text-embedding-3-small macht aus jedem Stück eine Zahlenreihe mit 1.536 Werten, damit sich nach Bedeutung statt nach gleichen Wörtern suchen lässt. ChromaDB speichert sie mit Video, Zeitspanne und Sprache.",
      en: "text-embedding-3-small turns every chunk into a vector of 1,536 values so it can be searched by meaning rather than by matching words. ChromaDB stores it with video, time span and language."},
    skills: {de: ["Retrieval-Augmented Generation: das Modell antwortet aus vorher gefundenen Textstellen", "Vektorsuche", "ChromaDB"], en: ["Retrieval-augmented generation: the model answers from passages found first", "Vector search", "ChromaDB"]}},
  {id: "ask", row: 3, col: 1, file: "README.md",
    title: {de: "Frage", en: "Question"},
    sub: {de: "getippt oder gesprochen", en: "typed or spoken"},
    text: {de: "In der Gradio-Oberfläche tippt oder spricht man die Frage; gesprochene Fragen schreibt Whisper mit. Die Oberfläche gibt es in zehn Sprachen.",
      en: "In the Gradio interface you type or speak the question; spoken questions are transcribed by Whisper. The interface comes in ten languages."},
    skills: {de: ["Weboberfläche mit Gradio", "Spracheingabe"], en: ["Web interface with Gradio", "Voice input"]}},
  {id: "agent", row: 3, col: 2, file: "ARCHITECTURE.md",
    title: {de: "Agent", en: "Agent"},
    sub: {de: "sieben Werkzeuge, Gedächtnis", en: "seven tools, memory"},
    text: {de: "Ein ReAct-Agent aus LangGraph entscheidet selbst, welches seiner sieben Werkzeuge er braucht: Stellen suchen, Videos auflisten, Video hinzufügen, Angaben abrufen, zusammenfassen, vergleichen, Schlüsselmomente finden. Die Suche ist fest auf das aktive Video gefiltert. MemorySaver merkt sich das Gespräch. Standard ist gpt-4o-mini, umschaltbar auf GPT-5, Llama 3.3 oder Qwen 2.5. LangSmith zeichnet Dauer und Kosten jedes Aufrufs auf.",
      en: "A LangGraph ReAct agent decides which of its seven tools it needs: search passages, list videos, add a video, fetch metadata, summarise, compare, extract key moments. Search is hard-filtered to the active video. MemorySaver keeps the conversation. The default is gpt-4o-mini, switchable to GPT-5, Llama 3.3 or Qwen 2.5. LangSmith records duration and cost of every call."},
    skills: {de: ["Agent mit Werkzeugen (ReAct)", "LangChain und LangGraph", "Gesprächsgedächtnis", "Sprachmodelle über Programmierschnittstellen (OpenAI, Hugging Face)", "Nachverfolgung mit LangSmith"], en: ["Tool-using agent (ReAct)", "LangChain and LangGraph", "Conversation memory", "Language models through APIs (OpenAI, Hugging Face)", "Tracing with LangSmith"]}},
  {id: "answer", row: 3, col: 3, file: "README.md",
    title: {de: "Antwort", en: "Answer"},
    sub: {de: "mit Zeitstempel und Kosten", en: "with timestamp and cost"},
    text: {de: "Die Antwort kommt in der Sprache der Frage, mit Links auf die Stelle im Video. Daneben stehen die drei passendsten Stellen und die Kosten der Anfrage, gerechnet aus den verbrauchten Textbausteinen (Tokens) und den Preisen aus prices.json.",
      en: "The answer comes in the language of the question, with links to the moment in the video. Next to it are the three best-matching passages and the cost of the request, computed from the tokens used and the prices in prices.json."},
    skills: {de: ["Mehrsprachige Antworten", "Kostenrechnung je Anfrage"], en: ["Multilingual answers", "Cost tracking per request"]}},
  {id: "judge", row: 3, col: 4, auto: true, file: "TECHNICAL_REPORT.md",
    title: {de: "Prüfer", en: "Judge"},
    sub: {de: "bewertet jede Antwort", en: "scores every answer"},
    text: {de: "Ein zweiter Aufruf von gpt-4o-mini bewertet jede Antwort von 1 bis 5 gegen die Untertitel und begründet das Urteil (ein Sprachmodell als Prüfer). Die Untertitel holt youtube-transcript-api. Weil Prüfer und Antwortgeber dasselbe Modell sind, stehen im Projekt-Tab alle Antworten zum Nachlesen.",
      en: "A second gpt-4o-mini call scores every answer from 1 to 5 against the captions and explains the verdict (a language model as judge). youtube-transcript-api fetches the captions. Because judge and answering model are the same, the Project tab prints every answer for checking."},
    skills: {de: ["Bewertung mit einem Sprachmodell als Prüfer", "Abgleich mit YouTube-Untertiteln"], en: ["Evaluation with a language model as judge", "Comparison with YouTube captions"]}},
];

const EDGES = [
  {from: "live", to: "audio", out: "bottom", in: "top", auto: true, label: {de: "startet", en: "starts"}},
  {from: "bench", to: "chunk", out: "bottom", in: "top", auto: true, label: {de: "Stückgrößen", en: "chunk sizes"}},
  {from: "audio", to: "whisper", out: "right", in: "left"},
  {from: "whisper", to: "chunk", out: "right", in: "left"},
  {from: "chunk", to: "store", out: "right", in: "left"},
  {from: "ask", to: "agent", out: "right", in: "left"},
  {from: "store", to: "agent", out: "bottom", in: "top"},
  {from: "agent", to: "answer", out: "right", in: "left"},
  {from: "answer", to: "judge", out: "right", in: "left", auto: true},
];

const PHONE = matchMedia("(max-width: 860px)");
let selected = "audio";
let wires = [];
let frame = 0;
let running = false;
let last = 0;

function anchor(node, side, box) {
  const r = node.getBoundingClientRect();
  const x = r.left - box.left;
  const y = r.top - box.top;
  return {left: [x, y + r.height / 2], right: [x + r.width, y + r.height / 2],
    top: [x + r.width / 2, y], bottom: [x + r.width / 2, y + r.height]}[side];
}

function curve(a, b, vertical) {
  if (vertical) {
    const bend = Math.max(24, Math.abs(b[1] - a[1]) / 2);
    return `M${a[0]},${a[1]} C${a[0]},${a[1] + bend} ${b[0]},${b[1] - bend} ${b[0]},${b[1]}`;
  }
  const bend = Math.max(18, Math.abs(b[0] - a[0]) / 2);
  return `M${a[0]},${a[1]} C${a[0] + bend},${a[1]} ${b[0] - bend},${b[1]} ${b[0]},${b[1]}`;
}

function desktopWires(box) {
  return EDGES.map((edge) => {
    const a = anchor(document.getElementById(`node-${edge.from}`), edge.out, box);
    const b = anchor(document.getElementById(`node-${edge.to}`), edge.in, box);
    return {d: curve(a, b, edge.out === "bottom"), auto: edge.auto, label: edge.label, to: edge.to};
  });
}

/* On a phone the stations stack; one rail on the left links them in reading order. */
function phoneWires(box) {
  const points = NODES.map((n) => {
    const r = document.getElementById(`node-${n.id}`).getBoundingClientRect();
    return {x: 12, y: r.top - box.top + Math.min(36, r.height / 2), to: n.id, right: r.left - box.left};
  });
  const rail = points.slice(1).map((p, i) => ({d: `M12,${points[i].y} L12,${p.y}`, to: p.to}));
  const stubs = points.map((p) => ({d: `M12,${p.y} L${p.right},${p.y}`, stub: true}));
  return [...rail, ...stubs];
}

function drawWires() {
  const host = document.getElementById("org-wires");
  const box = document.getElementById("org").getBoundingClientRect();
  host.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const specs = PHONE.matches ? phoneWires(box) : desktopWires(box);
  host.replaceChildren();
  wires = specs.map((spec, index) => {
    const path = svg("path", {d: spec.d, class: `wire${spec.auto ? " is-auto" : ""}`});
    host.append(path);
    const length = path.getTotalLength();
    if (spec.label && !PHONE.matches) {
      const mid = path.getPointAtLength(length / 2);
      host.append(svg("text", {x: mid.x + 8, y: mid.y - 6, class: "wire-label"}, document.createTextNode(tr(spec.label))));
    }
    if (spec.stub) return null;
    const dot = svg("circle", {r: 3.2, class: `spark${spec.auto ? " is-auto" : ""}`});
    host.append(dot);
    return {path, length, dot, to: spec.to, offset: (index * 0.37) % 1, speed: spec.auto ? 0.22 : 0.34};
  }).filter(Boolean);
  placeLaneLabels(box);
  step(0);
}

function placeLaneLabels(box) {
  for (const [cls, id] of [["lane-auto", "live"], ["lane-ingest", "audio"], ["lane-answer", "ask"]]) {
    const r = document.getElementById(`node-${id}`).getBoundingClientRect();
    document.querySelector(`.${cls}`).style.top = `${r.top - box.top - 24}px`;
  }
}

function step(dt) {
  for (const wire of wires) {
    const before = wire.offset;
    wire.offset = (wire.offset + dt * wire.speed) % 1;
    const point = wire.path.getPointAtLength(wire.offset * wire.length);
    wire.dot.setAttribute("cx", point.x);
    wire.dot.setAttribute("cy", point.y);
    if (wire.offset < before && wire.to) light(wire.to);
  }
}

function light(id) {
  const node = document.getElementById(`node-${id}`);
  node.classList.remove("is-lit");
  void node.offsetWidth;
  node.classList.add("is-lit");
}

function tick(now) {
  if (!running) return;
  step(last ? Math.min(0.05, (now - last) / 1000) : 0);
  last = now;
  frame = requestAnimationFrame(tick);
}

function detail(node) {
  return [
    el("h2", {text: tr(node.title)}),
    el("p", {text: tr(node.text)}),
    el("h3", {text: tr({de: "Angewandte Fähigkeiten", en: "Skills applied"})}),
    el("ul", {class: "chips"}, tr(node.skills).map((skill) => el("li", {text: skill}))),
    el("p", {class: "source"}, [document.createTextNode(tr({de: "Beleg im Repository: ", en: "Evidence in the repository: "})),
      el("a", {href: BLOB + node.file, rel: "noopener", text: node.file})]),
  ];
}

function select(id, focus = false) {
  selected = id;
  const node = NODES.find((n) => n.id === id);
  for (const n of NODES) document.getElementById(`node-${n.id}`).setAttribute("aria-pressed", String(n.id === id));
  const panel = document.getElementById("org-detail");
  panel.replaceChildren(...detail(node));
  const button = document.getElementById(`node-${id}`);
  if (PHONE.matches) button.closest("[role=listitem]").after(panel);
  else document.getElementById("org").append(panel);
  requestAnimationFrame(drawWires);
  if (focus && PHONE.matches) panel.scrollIntoView({block: "nearest", behavior: reducedMotion() ? "auto" : "smooth"});
}

function render() {
  const grid = document.getElementById("org-grid");
  grid.replaceChildren(...NODES.map((n) => el("div", {role: "listitem", class: "org-cell", style: {"grid-column": String(n.col), "grid-row": String(n.row)}},
    el("button", {type: "button", id: `node-${n.id}`, class: `node${n.auto ? " is-auto" : ""}`, "aria-pressed": "false", "aria-controls": "org-detail"}, [
      el("span", {class: "node-pulse", "aria-hidden": "true"}),
      el("span", {class: "node-title", text: tr(n.title)}),
      el("span", {class: "node-sub", text: tr(n.sub)}),
    ]))));
  for (const n of NODES) document.getElementById(`node-${n.id}`).addEventListener("click", () => select(n.id, true));
  select(selected);
}

export function mount() {
  render();
  onLang(() => { if (document.getElementById("org-grid").childElementCount) render(); });
  new ResizeObserver(() => requestAnimationFrame(drawWires)).observe(document.getElementById("org"));
  PHONE.addEventListener("change", () => select(selected));
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
}

export function resume() {
  if (document.getElementById("organigramm").hidden) return;
  requestAnimationFrame(drawWires);
  if (running || reducedMotion()) return;
  running = true;
  last = 0;
  frame = requestAnimationFrame(tick);
}

export function pause() {
  running = false;
  cancelAnimationFrame(frame);
}
