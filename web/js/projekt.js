/* Tab 1: the key figures of the live run and one card per video with every answer.
 * Context: figures are computed from data/live_eval.json (built from live_eval/results.json by
 * scripts/build_web_data.py), so the page never states a number the run does not carry.
 * | Input: data/live_eval.json | Output: verdict box, video cards with expandable answers. */
import {el, fmt, usd, icon, lang, onLang, loadJson} from "./dom.js";

const TEXT = {
  de: {
    minutes: "Min.", chunks: "Abschnitte", whisper: "Abschrift", wer: "Wortfehlerrate gegen Untertitel",
    open: "auf YouTube öffnen", answer: "Antwort des Analyzers", judge: "Urteil des Prüfers",
    reference: "Erwartete Antwort laut Untertiteln", extra: "Zusatzfrage",
    langs: {english: "Englisch", german: "Deutsch"}, videos: (n) => `${n}, Deutsch und Englisch`,
    verdicts: {fully_supported: "voll gedeckt", mostly_supported: "weitgehend gedeckt",
      partially_supported: "teilweise gedeckt", unsupported: "nicht gedeckt", contradicted: "widerlegt"},
    failed: "Die Daten des Testlaufs konnten nicht geladen werden. Bitte die Seite neu laden.",
  },
  en: {
    minutes: "min", chunks: "chunks", whisper: "transcription", wer: "word error rate vs captions",
    open: "open on YouTube", answer: "Analyzer's answer", judge: "Judge's verdict",
    reference: "Expected answer from the captions", extra: "extra question",
    langs: {english: "English", german: "German"}, videos: (n) => `${n}, German and English`,
    verdicts: {fully_supported: "fully supported", mostly_supported: "mostly supported",
      partially_supported: "partially supported", unsupported: "unsupported", contradicted: "contradicted"},
    failed: "The live-run data could not be loaded. Please reload the page.",
  },
};

let live = null;

function t(key) { return TEXT[lang()][key]; }

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

/* The agent answers in Markdown: bold, italics, numbered and bulleted lists, paragraphs. */
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

export function liveSummary(data) {
  const questions = data.videos.flatMap((video) => video.questions);
  return {
    count: questions.length,
    supported: questions.filter((q) => q.score === 5).length,
    latency: questions.reduce((sum, q) => sum + q.latency, 0) / questions.length,
    cost: questions.reduce((sum, q) => sum + q.cost, 0),
    whisperCost: data.videos.reduce((sum, v) => sum + v.whisper_cost, 0),
    videos: data.videos.length,
  };
}

function drawVerdict() {
  const s = liveSummary(live);
  const set = (key, value) => { document.querySelector(`[data-kpi="${key}"]`).textContent = value; };
  set("supported", `${s.supported} / ${s.count}`);
  set("latency", `${fmt(s.latency)} s`);
  set("cost", usd(s.cost, 3));
  set("videos", t("videos")(s.videos));
}

function questionBlock(q) {
  const verdict = t("verdicts")[q.verdict] || q.verdict || "–";
  const summary = el("summary", {}, [
    el("span", {class: "score" + (q.score === 5 ? "" : " low"), text: `${q.score ?? "?"}/5`}),
    el("span", {class: "qtext"}, [document.createTextNode(q.question),
      q.kind === "extra" ? el("em", {text: t("extra")}) : null]),
    el("span", {class: "lat", text: `${fmt(q.latency)} s`}),
  ]);
  const judge = el("div", {class: "judge"}, [
    el("p", {}, el("strong", {text: `${q.score}/5, ${verdict}`})),
    q.explanation ? el("p", {text: q.explanation}) : null,
    q.reference ? el("p", {}, [el("strong", {text: `${t("reference")}: `}), document.createTextNode(q.reference)]) : null,
  ]);
  return el("details", {class: "q"}, [summary, el("div", {class: "qbody"}, [
    el("div", {}, [el("h4", {text: t("answer")}), el("div", {class: "answer", html: markdown(q.answer)})]),
    el("div", {}, [el("h4", {text: t("judge")}), judge]),
  ])]);
}

function videoCard(video) {
  const facts = el("div", {class: "facts"}, [
    el("span", {}, el("strong", {text: `${Math.round(video.duration / 60)} ${t("minutes")}`})),
    el("span", {text: `${video.chunks} ${t("chunks")}`}),
    el("span", {text: `${t("whisper")} ${fmt(video.whisper_sec)} s, ${usd(video.whisper_cost, 3)}`}),
    video.language === "german" && video.wer != null ? el("span", {text: `${t("wer")} ${fmt(video.wer, 2)} %`}) : null,
  ]);
  const head = el("div", {class: "video-head"}, [
    el("div", {}, [
      el("div", {class: "tags"}, [el("span", {class: "tag", text: t("langs")[video.language] || video.language}),
        el("span", {class: "tag", text: video.channel.trim()})]),
      el("h3", {text: video.title}),
      facts,
    ]),
    el("a", {class: "yt", href: video.url, rel: "noopener"}, [document.createTextNode(t("open")), icon("i-out")]),
  ]);
  return el("article", {class: "video"}, [head, ...video.questions.map(questionBlock)]);
}

function draw() {
  if (!live) return;
  drawVerdict();
  const open = [...document.querySelectorAll("#videos details[open]")].map((d) => d.querySelector(".qtext").firstChild.textContent);
  document.getElementById("videos").replaceChildren(...live.videos.map(videoCard));
  for (const details of document.querySelectorAll("#videos details")) {
    if (open.includes(details.querySelector(".qtext").firstChild.textContent)) details.open = true;
  }
}

export async function renderProject() {
  onLang(draw);
  try {
    live = await loadJson("data/live_eval.json");
    draw();
  } catch (error) {
    document.getElementById("videos").replaceChildren(el("p", {class: "loading", text: t("failed")}));
    throw error;
  }
}
