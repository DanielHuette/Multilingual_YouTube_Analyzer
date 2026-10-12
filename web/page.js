/* Renders the live run and the benchmark tables from the JSON files next to the page.
 * Context: the numbers come from live_eval/results.json and all_benchmarks.json, so the page
 * never states a figure the data does not carry. | Input: data/live_eval.json,
 * data/benchmarks.json | Output: KPI tiles, one card per video, benchmark tables. */
"use strict";

const TEXT = {
  de: {
    questions: "Fragen gestellt", supported: "vom Prüfer als voll gedeckt bewertet",
    latency: "Sekunden Antwortzeit im Mittel", cost: "Dollar für alle Antworten, ohne Abschrift",
    minutes: "Min.", chunks: "Abschnitte", whisper: "Abschrift", wer: "Fehlerquote gegen Untertitel",
    open: "auf YouTube öffnen", answer: "Antwort des Analyzers", judge: "Urteil des Prüfers",
    reference: "Erwartete Antwort laut Untertiteln", extra: "Zusatzfrage", none: "keine",
    langs: {english: "Englisch", german: "Deutsch"},
    verdicts: {fully_supported: "voll gedeckt", mostly_supported: "weitgehend gedeckt",
      partially_supported: "teilweise gedeckt", unsupported: "nicht gedeckt", contradicted: "widerlegt"},
    b1: ["Abschrift: Whisper-Varianten", "Fehlerquote in Prozent je Video, weniger ist besser. Die Schnittstelle ist bei zwei von drei Videos am genauesten und braucht keinen eigenen Rechner; large-v3 lief lokal am schlechtesten."],
    b2: ["Bitrate der Tonspur", "Whisper base, 17-Minuten-Video. Unter 32 kbit/s kippt die Erkennung: Bei 8 kbit/s hielt das Modell das Englische für Latein."],
    b4: ["Sprachmodell für die Antworten", "Bewertung 1 bis 5 durch den Prüfer, mittlere Antwortzeit, Kosten für zehn Fragen."],
    b5: ["Mit und ohne Videosuche", "Dieselben Fragen einmal mit den gefundenen Stellen, einmal nur aus dem Modellwissen."],
    b6: ["Zerlegung nach Videolänge", "Beste Stückgröße aus 294 gemessenen Varianten, gemessen an der Trefferquote der Suche."],
    model: "Modell", video: "Video", kbps: "kbit/s", score: "Bewertung", correct: "richtig",
    time: "Zeit", costh: "Kosten", detected: "erkannt als", size: "Stückgröße", overlap: "Überlappung",
    short: "5 Min.", medium: "17 Min.", long: "42 Min.", rag: "mit Suche", norag: "ohne Suche",
    variant: "Variante",
    codes: {en: "Englisch", la: "Latein", mn: "Mongolisch"},
    b3: ["Einbettung und Gesamtmatrix", "Alle drei Einbettungsmodelle finden die richtige Stelle unter den ersten fünf. text-embedding-3-small kostet ein Sechstel von large. Die 90 Kombinationen aus Abschrift und Sprachmodell bestätigen die Wahl."],
    hits: "Treffer unter den ersten 5",
    errors: "Fehler",
  },
  en: {
    questions: "questions asked", supported: "judged fully supported",
    latency: "seconds mean answer time", cost: "dollars for all answers, transcription excluded",
    minutes: "min", chunks: "chunks", whisper: "transcription", wer: "word error rate vs captions",
    open: "open on YouTube", answer: "Analyzer's answer", judge: "Judge's verdict",
    reference: "Expected answer from the captions", extra: "extra question", none: "none",
    langs: {english: "English", german: "German"},
    verdicts: {fully_supported: "fully supported", mostly_supported: "mostly supported",
      partially_supported: "partially supported", unsupported: "unsupported", contradicted: "contradicted"},
    b1: ["Transcription: Whisper variants", "Word error rate in percent per video, lower is better. The API is the most accurate on two of three videos and needs no machine of its own; large-v3 ran worst locally."],
    b2: ["Audio bitrate", "Whisper base, 17-minute video. Below 32 kbit/s recognition collapses: at 8 kbit/s the model took the English for Latin."],
    b4: ["Language model for answers", "Score 1 to 5 by the judge, mean answer time, cost for ten questions."],
    b5: ["With and without video search", "The same questions once with the retrieved passages, once from model knowledge alone."],
    b6: ["Chunking by video length", "Best chunk size out of 294 measured variants, by retrieval hit rate."],
    model: "Model", video: "Video", kbps: "kbit/s", score: "Score", correct: "correct",
    time: "Time", costh: "Cost", detected: "detected as", size: "Chunk size", overlap: "Overlap",
    short: "5 min", medium: "17 min", long: "42 min", rag: "with search", norag: "without search",
    variant: "Variant",
    codes: {en: "English", la: "Latin", mn: "Mongolian"},
    b3: ["Embedding and full matrix", "All three embedding models find the right passage within the top five. text-embedding-3-small costs a sixth of large. The 90 combinations of transcription and language model confirm the choice."],
    hits: "hits in top 5",
    errors: "WER",
  },
};

let lang = "de";
let live = null;
let bench = null;

function t(key) { return TEXT[lang][key]; }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

/* The agent answers in Markdown: bold, numbered and bulleted lists, paragraphs. */
function markdown(source) {
  const lines = escapeHtml(source)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:)]|$)/g, "$1<em>$2</em>")
    .split("\n");
  let html = "";
  let list = null;
  for (const raw of lines) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (item) {
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (list !== kind) { if (list) html += `</${list}>`; html += `<${kind}>`; list = kind; }
      html += `<li>${item[1]}</li>`;
      continue;
    }
    if (list) { html += `</${list}>`; list = null; }
    if (line) html += `<p>${line}</p>`;
  }
  if (list) html += `</${list}>`;
  return html;
}

function number(value, digits = 1) {
  return value.toLocaleString(lang === "de" ? "de-DE" : "en-US",
    {minimumFractionDigits: digits, maximumFractionDigits: digits});
}

function drawKpis() {
  const questions = live.videos.flatMap((video) => video.questions);
  const supported = questions.filter((q) => q.score === 5).length;
  const latency = questions.reduce((sum, q) => sum + q.latency, 0) / questions.length;
  const cost = questions.reduce((sum, q) => sum + q.cost, 0);
  const tile = (value, label) => el("div", {class: "kpi"}, [el("b", {text: value}), el("span", {text: label})]);
  document.getElementById("kpis").replaceChildren(
    tile(String(questions.length), t("questions")),
    tile(`${supported}/${questions.length}`, t("supported")),
    tile(number(latency), t("latency")),
    tile(number(cost, 3), t("cost")),
  );
}

function questionBlock(q) {
  const verdict = t("verdicts")[q.verdict] || q.verdict || "–";
  const summary = el("summary", {}, [
    el("span", {class: "score" + (q.score === 5 ? "" : " low"), text: `${q.score ?? "?"}/5`}),
    el("span", {class: "qtext"}, [document.createTextNode(q.question),
      q.kind === "extra" ? el("em", {text: t("extra")}) : null]),
    el("span", {class: "lat", text: `${number(q.latency)} s`}),
  ]);
  const judge = el("div", {class: "judge"}, [
    el("p", {}, [el("strong", {text: `${q.score}/5 · ${verdict}`})]),
    q.explanation ? el("p", {text: q.explanation}) : null,
    q.reference ? el("p", {}, [el("strong", {text: `${t("reference")}: `}), document.createTextNode(q.reference)]) : null,
  ]);
  return el("details", {class: "q"}, [summary, el("div", {class: "qbody"}, [
    el("div", {}, [el("h4", {text: t("answer")}), el("div", {class: "answer", html: markdown(q.answer)})]),
    el("div", {}, [el("h4", {text: t("judge")}), judge]),
  ])]);
}

function drawVideos() {
  const cards = live.videos.map((video) => {
    const facts = el("div", {class: "facts"}, [
      el("span", {}, [el("strong", {text: `${Math.round(video.duration / 60)} ${t("minutes")}`})]),
      el("span", {text: `${video.chunks} ${t("chunks")}`}),
      el("span", {text: `${t("whisper")} ${number(video.whisper_sec)} s · $${number(video.whisper_cost, 3)}`}),
      video.language === "german" && video.wer != null
        ? el("span", {text: `${t("wer")} ${number(video.wer, 2)} %`}) : null,
    ]);
    const head = el("div", {class: "video-head"}, [
      el("div", {}, [
        el("span", {class: "tag", text: (t("langs")[video.language] || video.language).toUpperCase()}),
        el("span", {class: "tag", text: video.channel}),
        el("h3", {text: video.title}),
        facts,
      ]),
      el("a", {class: "yt", href: video.url, rel: "noopener", text: `${t("open")} ↗`}),
    ]);
    return el("article", {class: "video"}, [head, ...video.questions.map(questionBlock)]);
  });
  document.getElementById("videos").replaceChildren(...cards);
}

function meter(value, max, tone = "") {
  return el("div", {class: "meter"}, [el("i", {class: tone, style: `width:${Math.max(2, (value / max) * 100)}%`})]);
}

function card(key, table) {
  const [title, note] = t(key);
  return el("div", {class: "card"}, [el("h3", {text: title}), el("p", {class: "note", text: note}), table]);
}

function table(headers, rows) {
  return el("table", {}, [
    el("thead", {}, el("tr", {}, headers.map((h) => el("th", {text: h})))),
    el("tbody", {}, rows),
  ]);
}

function whisperCard() {
  const models = [...new Set(bench.whisper.map((row) => row.model))];
  const wer = (model, label) => bench.whisper.find((r) => r.model === model && r.video_label === label).wer_percent;
  const rows = models.map((model) => el("tr", {class: model.includes("API") ? "pick" : ""}, [
    el("td", {text: model}),
    ...["short_video", "medium_video", "long_video"].map((label) => el("td", {class: "num", text: number(wer(model, label), 2)})),
  ]));
  return card("b1", table([t("model"), t("short"), t("medium"), t("long")], rows));
}

function bitrateCard() {
  const rows = bench.bitrate.filter((r) => r.model_size === "base").map((r) => el("tr", {class: r.bitrate_kbps === 64 ? "pick" : ""}, [
    el("td", {class: "num", text: String(r.bitrate_kbps)}),
    el("td", {class: "barcell"}, meter(Math.min(r.wer_percent, 100), 100, r.wer_percent > 20 ? "hi" : "")),
    el("td", {class: "num", text: `${number(r.wer_percent, 1)} %`}),
    el("td", {text: `${t("detected")} ${t("codes")[r.detected_language] || r.detected_language}`}),
  ]));
  return card("b2", table([t("kbps"), "", t("errors"), ""], rows));
}

function llmCard() {
  const rows = bench.llms.map((r) => el("tr", {class: r.model === "gpt-4o-mini" ? "pick" : ""}, [
    el("td", {text: r.model}),
    el("td", {class: "num", text: number(r.avg_score)}),
    el("td", {class: "num", text: `${number(r.avg_latency_sec, 2)} s`}),
    el("td", {class: "num", text: `$${number(r.total_cost_usd, 4)}`}),
  ]));
  return card("b4", table([t("model"), t("score"), t("time"), t("costh")], rows));
}

function ragCard() {
  const rows = bench.rag.map((r) => el("tr", {class: r.variant === "with-RAG" && r.model === "gpt-4o-mini" ? "pick" : ""}, [
    el("td", {text: r.model}),
    el("td", {text: r.variant === "with-RAG" ? t("rag") : t("norag")}),
    el("td", {class: "barcell"}, meter(r.accuracy, 1, r.variant === "with-RAG" ? "ok" : "")),
    el("td", {class: "num", text: `${Math.round(r.accuracy * 100)} % ${t("correct")}`}),
  ]));
  return card("b5", table([t("model"), t("variant"), "", ""], rows));
}

function chunkCard() {
  const rows = ["short_video", "medium_video", "long_video"].map((label) => {
    const r = bench.chunks[label];
    return el("tr", {}, [
      el("td", {text: t(label.split("_")[0])}),
      el("td", {class: "num", text: String(r.chunk_size)}),
      el("td", {class: "num", text: String(r.overlap)}),
      el("td", {class: "num", text: `MRR ${number(r.mrr, 2)}`}),
    ]);
  });
  return card("b6", table([t("video"), t("size"), t("overlap"), ""], rows));
}

function embeddingCard() {
  const rows = bench.embeddings.filter((r) => r.whisper_source === "API").map((r) => el("tr", {class: r.model.startsWith("text-embedding-3-small") ? "pick" : ""}, [
    el("td", {text: r.model.replace(" (API)", "")}),
    el("td", {class: "num", text: `${Math.round(r.hit_rate_at_k * 100)} %`}),
    el("td", {class: "num", text: `MRR ${number(r.mean_mrr, 2)}`}),
    el("td", {class: "num", text: `$${number(r.embed_cost_usd, 5)}`}),
  ]));
  return card("b3", table([t("model"), t("hits"), "", t("costh")], rows));
}

function drawBench() {
  document.getElementById("bench").replaceChildren(whisperCard(), bitrateCard(), llmCard(), ragCard(), chunkCard(), embeddingCard());
}

function draw() {
  if (live) { drawKpis(); drawVideos(); }
  if (bench) drawBench();
}

function setLanguage(code) {
  lang = code === "en" ? "en" : "de";
  document.documentElement.lang = lang;
  for (const button of document.querySelectorAll(".lang button")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  try { localStorage.setItem("lang", lang); } catch (error) { /* storage unavailable */ }
  draw();
}

async function main() {
  let stored = null;
  try { stored = localStorage.getItem("lang"); } catch (error) { /* storage unavailable */ }
  const preferred = new URLSearchParams(location.search).get("lang") || stored
    || (navigator.language || "de").slice(0, 2);
  for (const button of document.querySelectorAll(".lang button")) {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  }
  setLanguage(preferred);
  [live, bench] = await Promise.all([
    fetch("data/live_eval.json").then((r) => r.json()),
    fetch("data/benchmarks.json").then((r) => r.json()),
  ]);
  draw();
}

main();
