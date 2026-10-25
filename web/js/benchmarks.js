/* Tab 3: the live run and the seven benchmarks as charts with a plain-language takeaway each.
 * Context: every value comes from data/live_eval.json or data/benchmarks.json, both built by
 * scripts/build_web_data.py from live_eval/results.json and all_benchmarks.json; numbers are
 * printed as measured, never rounded into new claims. | Input: the two data files | Output: one
 * figure per measurement with chart, takeaway, source link and a table view. */
import {el, svg, fmt, usd, tr, lang, onLang, loadJson, wireTooltips, BLOB} from "./dom.js";
import {liveSummary} from "./projekt.js";

const BENCH_FILE = "benchmark_imports_for_QandA_notebook/all_benchmarks.json";
const VIDEO = {short_video: {de: "5-Minuten-Video", en: "5-minute video"}, medium_video: {de: "17-Minuten-Video", en: "17-minute video"}, long_video: {de: "42-Minuten-Video", en: "42-minute video"}};
const VIDEO_KEYS = Object.keys(VIDEO);
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
const LANGS = {en: {de: "Englisch", en: "English"}, la: {de: "Latein", en: "Latin"}, mn: {de: "Mongolisch", en: "Mongolian"}};
let live = null;
let bench = null;

const pct = (value, digits = 0) => `${fmt(value, digits)} %`;
const T = (de, en) => tr({de, en});

function source(file, key) {
  return el("p", {class: "source"}, [document.createTextNode(T("Quelle: ", "Source: ")),
    el("a", {href: BLOB + file, rel: "noopener", text: file}), key ? document.createTextNode(`, ${key}`) : null]);
}

function table(headers, rows) {
  return el("details", {}, [el("summary", {text: T("Werte als Tabelle", "Values as a table")}),
    el("table", {class: "values"}, [
      el("thead", {}, el("tr", {}, headers.map((h) => el("th", {class: h.num ? "num" : null, scope: "col", text: h.text ?? h})))),
      el("tbody", {}, rows.map((row) => el("tr", {class: row.pick ? "is-pick" : null},
        row.cells.map((cell, i) => el("td", {class: headers[i].num ? "num" : null, text: cell}))))),
    ])]);
}

function figure({id, title, takeaway, explain, body, file, key, values}) {
  return el("figure", {class: "figure", id, "aria-labelledby": `${id}-title`}, [
    el("h2", {id: `${id}-title`, text: title}),
    el("p", {class: "takeaway", text: takeaway}),
    explain ? el("p", {class: "explain", text: explain}) : null,
    body, source(file, key), values,
  ]);
}

function tip(node, title, lines) {
  node.dataset.tipTitle = title;
  node.dataset.tip = lines.join("|");
  node.tabIndex = 0;
  return node;
}

/* A row chart: label column, a track with marks positioned in percent, a value column. */
function row({label, sub, marks, value, pick}) {
  return el("div", {class: `row${pick ? " is-pick" : ""}`}, [
    el("div", {class: "row-label"}, [document.createTextNode(label), sub ? el("small", {text: sub}) : null]),
    el("div", {class: "track"}, marks),
    el("div", {class: "row-value", text: value}),
  ]);
}

function axis(max, ticks, label) {
  return el("div", {class: "axis", "aria-hidden": "true"}, [el("span"), el("div", {class: "axis-scale"},
    ticks.map((t) => el("span", {style: {left: `${(t / max) * 100}%`}, text: label(t)}))), el("span")]);
}

const seconds = (t) => `${fmt(t, 0)} s`;

const bar = (value, max) => el("i", {class: "bar-fill", style: {width: `${Math.max(1.5, (value / max) * 100)}%`}});
const dot = (value, max, color) => el("i", {class: "dot", style: {left: `${(value / max) * 100}%`, background: color}});

function liveFigure() {
  const s = liveSummary(live);
  const all = live.videos.flatMap((v) => v.questions.map((q) => q.latency));
  const max = 5.5;
  const german = live.videos.find((v) => v.language === "german");
  const stats = el("div", {class: "stats"}, [
    [`${s.supported} / ${s.count}`, T("Antworten voll durch die Untertitel gedeckt", "answers fully supported by the captions")],
    [`${fmt(s.latency)} s`, T("Antwortzeit im Mittel", "mean answer time")],
    [fmt(s.cost, 3), T("US-Dollar für alle Antworten des Agenten", "dollars for all agent answers")],
    [fmt(s.whisperCost, 2), T("US-Dollar für die Abschrift aller vier Videos", "dollars to transcribe all four videos")],
  ].map(([value, label]) => el("div", {class: "stat"}, [el("b", {text: value}), el("span", {text: label})])));
  const rows = live.videos.map((v) => {
    const mean = v.questions.reduce((sum, q) => sum + q.latency, 0) / v.questions.length;
    return row({label: v.title.split(/[|:(]/)[0].trim(), sub: `${Math.round(v.duration / 60)} ${T("Min.", "min")}, ${T(v.language === "german" ? "Deutsch" : "Englisch", v.language === "german" ? "German" : "English")}`,
      marks: v.questions.map((q) => tip(dot(q.latency, max, "var(--gold)"), `${fmt(q.latency, 2)} s`, [q.question])),
      value: `${T("Mittel", "mean")} ${fmt(mean)} s`});
  });
  return figure({id: "live", title: T("Echter Testlauf: 37 Fragen an vier Videos", "Live run: 37 questions to four videos"),
    takeaway: T(`Jede der ${s.count} Antworten kam nach ${fmt(Math.min(...all))} bis ${fmt(Math.max(...all))} Sekunden, und der Prüfer fand jede voll durch die Untertitel gedeckt. Beim deutschen Video wich die Abschrift in ${fmt(german.wer, 2)} % der Wörter von den YouTube-Untertiteln ab.`,
      `Each of the ${s.count} answers arrived after ${fmt(Math.min(...all))} to ${fmt(Math.max(...all))} seconds, and the judge found every one fully supported by the captions. For the German video the transcript differed from the YouTube captions in ${fmt(german.wer, 2)} % of the words.`),
    explain: T("Ein Punkt ist eine Antwort; die Lage zeigt, wie lange sie gedauert hat.", "One dot is one answer; its position shows how long it took."),
    body: el("div", {}, [stats, el("div", {class: "rows"}, rows), axis(max, [0, 1, 2, 3, 4, 5], seconds)]),
    file: "live_eval/results.json",
    values: table([T("Video", "Video"), {text: T("Fragen", "Questions"), num: true}, {text: T("voll gedeckt", "fully supported"), num: true}, {text: T("Abschrift in US-Dollar", "Transcription in dollars"), num: true}],
      live.videos.map((v) => ({cells: [v.title, String(v.questions.length), String(v.questions.filter((q) => q.score === 5).length), fmt(v.whisper_cost, 4)]})))});
}

function ragFigure() {
  const models = [...new Set(bench.rag.map((r) => r.model))];
  const get = (model, variant) => bench.rag.find((r) => r.model === model && r.variant === variant);
  const rows = models.map((model) => {
    const off = get(model, "no-RAG");
    const on = get(model, "with-RAG");
    return row({label: model, pick: model === "gpt-4o-mini", value: `${pct(off.accuracy * 100)} / ${pct(on.accuracy * 100)}`, marks: [
      el("i", {class: "span-line", style: {left: `${off.accuracy * 100}%`, width: `${(on.accuracy - off.accuracy) * 100}%`}}),
      tip(dot(off.accuracy, 1, "var(--rest)"), T("ohne Suche", "without search"), [`${pct(off.accuracy * 100)} ${T("richtig", "correct")}`, `${T("Bewertung", "score")} ${fmt(off.avg_score)}`]),
      tip(dot(on.accuracy, 1, "var(--gold)"), T("mit Suche", "with search"), [`${pct(on.accuracy * 100)} ${T("richtig", "correct")}`, `${T("Bewertung", "score")} ${fmt(on.avg_score)}`]),
    ]});
  });
  const legend = el("ul", {class: "legend"}, [
    el("li", {}, [el("i", {class: "swatch", style: {background: "var(--rest)"}}), document.createTextNode(T("ohne Videosuche", "without video search"))]),
    el("li", {}, [el("i", {class: "swatch", style: {background: "var(--gold)"}}), document.createTextNode(T("mit Videosuche", "with video search"))]),
  ]);
  const [a, b] = models.map((m) => get(m, "no-RAG"));
  return figure({id: "rag", title: T("Ohne Videosuche rät das Modell", "Without video search the model guesses"),
    takeaway: T(`Mit den gefundenen Videostellen beantworten beide Modelle alle zehn Testfragen richtig. Ohne sie schafft ${a.model} ${pct(a.accuracy * 100)} und ${b.model} ${pct(b.accuracy * 100)}.`,
      `With the retrieved passages both models answer all ten test questions correctly. Without them ${a.model} manages ${pct(a.accuracy * 100)} and ${b.model} ${pct(b.accuracy * 100)}.`),
    explain: T("Richtig heißt: der Prüfer gibt mindestens 4 von 5 Punkten. Zehn Fragen zum 17-Minuten-Video, einmal mit den fünf besten Stellen, einmal nur aus dem Wissen des Modells.", "Correct means the judge gives at least 4 of 5 points. Ten questions about the 17-minute video, once with the five best passages, once from the model's own knowledge."),
    body: el("div", {}, [legend, el("div", {class: "rows"}, rows), axis(1, [0, 0.5, 1], (t) => pct(t * 100))]),
    file: BENCH_FILE, key: "benchmark5_rag_vs_norag",
    values: table([T("Modell", "Model"), T("Variante", "Variant"), {text: T("Bewertung", "Score"), num: true}, {text: T("richtig", "correct"), num: true}, {text: T("Zeit in s", "Time in s"), num: true}, {text: T("Kosten in US-Dollar", "Cost in dollars"), num: true}],
      bench.rag.map((r) => ({pick: r.model === "gpt-4o-mini" && r.variant === "with-RAG", cells: [r.model, r.variant === "with-RAG" ? T("mit Suche", "with search") : T("ohne Suche", "without search"),
        fmt(r.avg_score), pct(r.accuracy * 100), fmt(r.avg_latency_sec, 2), fmt(r.total_cost_usd, 5)]})))});
}

function llmFigure() {
  const max = Math.max(...bench.llms.map((r) => r.avg_latency_sec));
  const rows = bench.llms.map((r) => row({label: r.model, pick: r.model === "gpt-4o-mini",
    sub: `${T("Bewertung", "score")} ${fmt(r.avg_score)}, ${usd(r.total_cost_usd, 5)}`,
    marks: tip(bar(r.avg_latency_sec, max), r.model, [`${fmt(r.avg_latency_sec, 2)} s ${T("im Mittel", "mean")}`, `${T("Bewertung", "score")} ${fmt(r.avg_score)} / 5`, `${usd(r.total_cost_usd, 5)} ${T("für zehn Fragen", "for ten questions")}`]),
    value: `${fmt(r.avg_latency_sec, 2)} s`}));
  const pick = bench.llms.find((r) => r.model === "gpt-4o-mini");
  const scores = bench.llms.map((r) => r.avg_score);
  return figure({id: "llm", title: T("Das schnellste OpenAI-Modell reicht", "The fastest OpenAI model is enough"),
    takeaway: T(`Mit Videosuche liegen alle fünf Sprachmodelle bei ${fmt(Math.min(...scores))} bis ${fmt(Math.max(...scores))} von 5 Punkten. ${pick.model} antwortet unter den OpenAI-Modellen am schnellsten (${fmt(pick.avg_latency_sec, 2)} s) und kostete ${usd(pick.total_cost_usd, 5)} für alle zehn Fragen; es ist voreingestellt.`,
      `With video search all five language models score ${fmt(Math.min(...scores))} to ${fmt(Math.max(...scores))} of 5. ${pick.model} is the fastest OpenAI model (${fmt(pick.avg_latency_sec, 2)} s) and cost ${usd(pick.total_cost_usd, 5)} for all ten questions; it is the default.`),
    explain: T("Balken: mittlere Antwortzeit. Die beiden hf-Modelle liefen über die kostenlose Schnittstelle von Hugging Face.", "Bars: mean answer time. The two hf models ran on the free Hugging Face API."),
    body: el("div", {}, [el("div", {class: "rows"}, rows), axis(max, [0, 1, 2, 3, 4], seconds)]),
    file: BENCH_FILE, key: "benchmark4_llms",
    values: table([T("Modell", "Model"), {text: T("Bewertung", "Score"), num: true}, {text: T("richtig", "correct"), num: true}, {text: T("Zeit in s", "Time in s"), num: true}, {text: T("Kosten in US-Dollar", "Cost in dollars"), num: true}],
      bench.llms.map((r) => ({pick: r.model === "gpt-4o-mini", cells: [r.model, fmt(r.avg_score), pct(r.accuracy * 100), fmt(r.avg_latency_sec, 2), fmt(r.total_cost_usd, 5)]})))});
}

function whisperFigure() {
  const models = [...new Set(bench.whisper.map((r) => r.model))];
  const wer = (model, label) => bench.whisper.find((r) => r.model === model && r.video_label === label);
  const max = 20;
  const rows = models.map((model) => row({label: model, pick: model.includes("API"),
    marks: VIDEO_KEYS.map((label, i) => tip(dot(wer(model, label).wer_percent, max, SERIES[i]), `${model}, ${tr(VIDEO[label])}`,
      [`${T("Wortfehlerrate", "Word error rate")} ${pct(wer(model, label).wer_percent, 2)}`, `${T("Dauer", "Time")} ${fmt(wer(model, label).total_time_sec)} s`])),
    value: ""}));
  const legend = el("ul", {class: "legend"}, VIDEO_KEYS.map((label, i) => el("li", {}, [el("i", {class: "swatch", style: {background: SERIES[i]}}), document.createTextNode(tr(VIDEO[label]))])));
  const large = models.find((m) => m.includes("large"));
  const largeValues = VIDEO_KEYS.map((l) => wer(large, l).wer_percent);
  return figure({id: "whisper", title: T("Die Programmierschnittstelle schreibt am genauesten mit", "The API transcribes most accurately"),
    takeaway: T(`whisper-1 über die Programmierschnittstelle war bei zwei von drei Videos am genauesten und braucht keinen eigenen Rechner; deshalb ist es voreingestellt. large-v3 lag auf dem Testrechner bei allen drei Videos am schlechtesten (${pct(Math.min(...largeValues), 2)} bis ${pct(Math.max(...largeValues), 2)}).`,
      `whisper-1 through the API was the most accurate on two of three videos and needs no machine of its own, so it is the default. large-v3 did worst on all three videos on the test machine (${pct(Math.min(...largeValues), 2)} to ${pct(Math.max(...largeValues), 2)}).`),
    explain: T("Wortfehlerrate: Anteil der Wörter, die gegenüber den YouTube-Untertiteln falsch, fehlend oder überzählig sind. Weiter links ist besser.", "Word error rate: share of words that are wrong, missing or extra compared with the YouTube captions. Further left is better."),
    body: el("div", {}, [legend, el("div", {class: "rows"}, rows), axis(max, [0, 5, 10, 15, 20], (t) => pct(t))]),
    file: BENCH_FILE, key: "benchmark1_whisper_sizes",
    values: table([T("Modell", "Model"), ...VIDEO_KEYS.map((l) => ({text: tr(VIDEO[l]), num: true}))],
      models.map((model) => ({pick: model.includes("API"), cells: [model, ...VIDEO_KEYS.map((l) => pct(wer(model, l).wer_percent, 2))]})))});
}

function lineChart(series, xs, pickX) {
  const host = el("div", {class: "chart"});
  const draw = () => {
    const width = Math.max(260, host.clientWidth);
    const height = 240;
    const pad = {l: 40, r: 96, t: 12, b: 28};
    const x = (i) => pad.l + (i / (xs.length - 1)) * (width - pad.l - pad.r);
    const y = (v) => pad.t + (1 - v / 100) * (height - pad.t - pad.b);
    const nodes = [svg("rect", {class: "pick-band", x: x(xs.indexOf(pickX)) - 16, y: pad.t, width: 32, height: height - pad.t - pad.b, rx: 6})];
    for (const v of [0, 25, 50, 75, 100]) nodes.push(svg("line", {class: "gridline", x1: pad.l, x2: width - pad.r, y1: y(v), y2: y(v)}), svg("text", {class: "tick", x: pad.l - 8, y: y(v) + 4, "text-anchor": "end"}, document.createTextNode(`${v} %`)));
    xs.forEach((value, i) => nodes.push(svg("text", {class: "tick", x: x(i), y: height - 8, "text-anchor": "middle"}, document.createTextNode(String(value)))));
    for (const s of series) {
      nodes.push(svg("polyline", {class: "line", stroke: s.color, points: s.values.map((v, i) => `${x(i)},${y(v.y)}`).join(" ")}));
      s.values.forEach((v, i) => {
        const point = svg("circle", {class: "point", cx: x(i), cy: y(v.y), r: 5, fill: s.color, tabindex: 0});
        point.dataset.tipTitle = `${s.name}, ${xs[i]} ${T("Kilobit je Sekunde", "kilobits per second")}`;
        point.dataset.tip = v.tip.join("|");
        nodes.push(point);
      });
      const end = s.values.at(-1);
      nodes.push(svg("text", {class: "label", x: x(xs.length - 1) + 10, y: y(end.y) + s.dy, fill: s.color}, document.createTextNode(s.name)));
    }
    host.replaceChildren(svg("svg", {viewBox: `0 0 ${width} ${height}`, width, height, role: "img", "aria-label": T("Wortfehlerrate je Bitrate", "Word error rate per bitrate")}, nodes));
  };
  new ResizeObserver(draw).observe(host);
  return host;
}

function bitrateFigure() {
  const sizes = ["base", "small"];
  const xs = [...new Set(bench.bitrate.map((r) => r.bitrate_kbps))];
  const at = (size, kbps) => bench.bitrate.find((r) => r.model_size === size && r.bitrate_kbps === kbps);
  const series = sizes.map((size, i) => ({name: `whisper-${size}`, color: SERIES[i + 1], dy: i === 0 ? -6 : 12,
    values: xs.map((kbps) => ({y: Math.min(100, at(size, kbps).wer_percent), tip: [`${T("Wortfehlerrate", "Word error rate")} ${pct(at(size, kbps).wer_percent, 2)}`, `${T("erkannt als", "detected as")} ${tr(LANGS[at(size, kbps).detected_language])}`]}))}));
  const low = sizes.map((size) => at(size, xs[0]));
  const half = at("base", 64);
  const full = at("base", 128);
  return figure({id: "bitrate", title: T("Unter 32 Kilobit je Sekunde kippt die Erkennung", "Below 32 kilobits per second recognition collapses"),
    takeaway: T(`Ab 32 Kilobit je Sekunde bleibt die Fehlerquote flach. Bei 8 Kilobit hielt Whisper das Englische für ${tr(LANGS[low[0].detected_language])} (base) und ${tr(LANGS[low[1].detected_language])} (small). 64 Kilobit treffen so genau wie 128, bei ${fmt(half.audio_size_kb, 1)} statt ${fmt(full.audio_size_kb, 1)} Kilobyte Datei.`,
      `From 32 kilobits per second the error rate stays flat. At 8 kilobits Whisper took the English for ${tr(LANGS[low[0].detected_language])} (base) and ${tr(LANGS[low[1].detected_language])} (small). 64 kilobits are as accurate as 128 with a file of ${fmt(half.audio_size_kb, 1)} instead of ${fmt(full.audio_size_kb, 1)} kilobytes.`),
    explain: T("17-Minuten-Video. Senkrecht die Wortfehlerrate, waagerecht die Bitrate der Tonspur; der helle Streifen markiert die gewählten 64 Kilobit.", "17-minute video. Vertical: word error rate; horizontal: audio bitrate; the light band marks the chosen 64 kilobits."),
    body: lineChart(series, xs, 64),
    file: BENCH_FILE, key: "benchmark2_bitrates",
    values: table([{text: T("Kilobit je Sekunde", "Kilobits per second"), num: true}, {text: "base", num: true}, {text: "small", num: true}, {text: T("Datei", "File"), num: true}],
      xs.map((kbps) => ({pick: kbps === 64, cells: [String(kbps), pct(at("base", kbps).wer_percent, 2), pct(at("small", kbps).wer_percent, 2), `${fmt(at("base", kbps).audio_size_kb, 1)} kB`]})))});
}

function heatColor(score) {
  const t = Math.max(0, Math.min(1, (score - 1) / 4));
  return `color-mix(in oklab, #3a3f52 ${Math.round((1 - t) * 100)}%, #d8bb82)`;
}

function matrixFigure() {
  const m = bench.matrix;
  const whisper = [...new Set(m.rows.map((r) => r.whisper_model))];
  const llms = [...new Set(m.rows.map((r) => r.llm_model))];
  const cell = (w, l) => m.rows.find((r) => r.whisper_model === w && r.llm_model === l);
  const grid = el("div", {class: "heat"}, [el("span"), ...llms.map((l) => el("span", {class: "h-col", text: l}))]);
  for (const w of whisper) {
    grid.append(el("span", {class: "h-row", text: w.replace("local: ", "")}));
    for (const l of llms) {
      const c = cell(w, l);
      grid.append(tip(el("span", {class: `cell${w.startsWith("api") && l === "gpt-4o-mini" ? " is-pick" : ""}`, style: {background: heatColor(c.llm_avg_score)}},
        [document.createTextNode(fmt(c.llm_avg_score)), el("small", {text: fmt(c.combo_total_cost_usd, 3)})]), `${w} + ${l}`,
        [`${T("Bewertung", "Score")} ${fmt(c.llm_avg_score)} / 5`, `${T("Kosten", "Cost")} ${usd(c.combo_total_cost_usd, 5)}`, `${T("Antwortzeit", "Answer time")} ${fmt(c.llm_avg_latency_sec, 2)} s`]));
    }
  }
  const scores = m.rows.map((r) => r.llm_avg_score);
  const costs = m.rows.map((r) => r.combo_total_cost_usd);
  return figure({id: "matrix", title: T("Jede Kombination antwortet gut, der Preis entscheidet", "Every combination answers well, price decides"),
    takeaway: T(`Beim 17-Minuten-Video bekommen alle ${m.rows.length} Kombinationen aus Abschrift und Sprachmodell ${fmt(Math.min(...scores))} bis ${fmt(Math.max(...scores))} von 5 Punkten. Die Kosten je Kombination reichen von ${usd(Math.min(...costs), 5)} bis ${usd(Math.max(...costs), 5)}.`,
      `For the 17-minute video all ${m.rows.length} combinations of transcription and language model score ${fmt(Math.min(...scores))} to ${fmt(Math.max(...scores))} of 5. Cost per combination ranges from ${usd(Math.min(...costs), 5)} to ${usd(Math.max(...costs), 5)}.`),
    explain: T(`Zeilen: Abschrift, Spalten: Sprachmodell; große Zahl: Bewertung, kleine Zahl: Kosten in US-Dollar für Abschrift, zehn Antworten und Prüfung. Gold umrandet: die Voreinstellung. Die Messreihe hat dieselben zehn Fragen auch an die Abschriften der beiden anderen Videos gestellt (${m.total - m.rows.length} weitere Kombinationen); dort steht die Antwort nicht drin, die Bewertung liegt deshalb bei ${fmt(m.other_score_min)} bis ${fmt(m.other_score_max)}.`,
      `Rows: transcription, columns: language model; large number: score, small number: cost in dollars for transcription, ten answers and judging. Gold outline: the default. The benchmark also put the same ten questions to the transcripts of the two other videos (${m.total - m.rows.length} more combinations); the answers are not in those videos, so they score ${fmt(m.other_score_min)} to ${fmt(m.other_score_max)}.`),
    body: grid, file: BENCH_FILE, key: "benchmark7_full_matrix",
    values: table([T("Abschrift", "Transcription"), T("Sprachmodell", "Language model"), {text: T("Bewertung", "Score"), num: true}, {text: T("Kosten in US-Dollar", "Cost in dollars"), num: true}],
      m.rows.map((r) => ({pick: r.whisper_model.startsWith("api") && r.llm_model === "gpt-4o-mini", cells: [r.whisper_model, r.llm_model, fmt(r.llm_avg_score), fmt(r.combo_total_cost_usd, 5)]})))});
}

function embeddingFigure() {
  const rows = bench.embeddings.filter((r) => r.whisper_source === "API");
  const max = Math.max(...rows.map((r) => r.embed_cost_usd));
  const name = (r) => r.model.replace(/ \(.*\)$/, "");
  const small = rows.find((r) => name(r) === "text-embedding-3-small");
  const large = rows.find((r) => name(r) === "text-embedding-3-large");
  return figure({id: "embedding", title: T("Das kleine Einbettungsmodell genügt", "The small embedding model is enough"),
    takeaway: T(`Alle drei Modelle finden die passende Stelle unter den ersten fünf Treffern. text-embedding-3-small kostete ${usd(small.embed_cost_usd, 5)}, text-embedding-3-large ${usd(large.embed_cost_usd, 5)}; bge-small läuft auf dem eigenen Rechner ohne Gebühr.`,
      `All three models find the right passage within the first five hits. text-embedding-3-small cost ${usd(small.embed_cost_usd, 5)}, text-embedding-3-large ${usd(large.embed_cost_usd, 5)}; bge-small runs on your own machine at no charge.`),
    explain: T("Einbettung: Text wird zu einer Zahlenreihe, damit die Suche nach Bedeutung statt nach gleichen Wörtern geht. Balken: Kosten für das 17-Minuten-Video.", "Embedding: text becomes a vector so search works by meaning rather than matching words. Bars: cost for the 17-minute video."),
    body: el("div", {class: "rows"}, rows.map((r) => row({label: name(r), pick: r === small,
      sub: `${T("Treffer unter den ersten 5", "hits in top 5")}: ${pct(r.hit_rate_at_k * 100)}`,
      marks: tip(bar(r.embed_cost_usd, max), name(r), [usd(r.embed_cost_usd, 5), `${T("Rangwert", "Rank score")} ${fmt(r.mean_mrr, 2)}`]),
      value: usd(r.embed_cost_usd, 5)}))),
    file: BENCH_FILE, key: "benchmark3_embeddings",
    values: table([T("Modell", "Model"), T("Abschrift", "Transcript"), {text: T("Treffer", "Hits"), num: true}, {text: T("Rangwert", "Rank score"), num: true}, {text: T("Kosten in US-Dollar", "Cost in dollars"), num: true}],
      bench.embeddings.map((r) => ({pick: r.model === small.model, cells: [name(r), r.whisper_source === "API" ? "whisper-1 (API)" : "whisper-small", pct(r.hit_rate_at_k * 100), fmt(r.mean_mrr, 2), fmt(r.embed_cost_usd, 5)]})))});
}

function chunkFigure() {
  const rows = VIDEO_KEYS.map((label) => ({label, ...bench.chunks[label]}));
  const max = Math.max(...rows.map((r) => r.chunk_size));
  const [a, b, c] = rows.map((r) => r.chunk_size);
  return figure({id: "chunks", title: T("Keine Stückgröße passt für alle Videos", "No chunk size fits every video"),
    takeaway: T(`Aus ${bench.chunk_grid_size} gemessenen Zerlegungen war beim 5-Minuten-Video die Stückgröße ${a} am besten, beim 17-Minuten-Video ${b}, beim 42-Minuten-Video ${c}. Der Analyzer wählt sie deshalb beim Aufnehmen nach der Länge des Videos.`,
      `Out of ${bench.chunk_grid_size} measured chunkings, chunk size ${a} worked best for the 5-minute video, ${b} for the 17-minute video and ${c} for the 42-minute video. The analyzer therefore picks it by video length when taking in a video.`),
    explain: T("Rangwert (Mean Reciprocal Rank): 1,00 heißt, die passende Stelle stand bei jeder Frage auf Platz 1; 0,50 hieße im Schnitt Platz 2. Werte für die Abschrift über die Programmierschnittstelle.", "Rank score (mean reciprocal rank): 1.00 means the right passage was in first place for every question; 0.50 would mean second place on average. Values for the API transcript."),
    body: el("div", {class: "rows"}, rows.map((r) => row({label: tr(VIDEO[r.label]), pick: true,
      sub: `${T("Überlappung", "overlap")} ${r.overlap}, ${T("Rangwert", "rank score")} ${fmt(r.mrr, 2)}`,
      marks: tip(bar(r.chunk_size, max), tr(VIDEO[r.label]), [`${T("Stückgröße", "Chunk size")} ${r.chunk_size}`, `${T("Treffer unter den ersten 5", "Hits in top 5")} ${pct(r.hit_rate_at_5 * 100)}`]),
      value: String(r.chunk_size)}))),
    file: "benchmark_imports_for_QandA_notebook/chunk_recommendations.json", key: "api",
    values: table([T("Video", "Video"), {text: T("Stückgröße", "Chunk size"), num: true}, {text: T("Überlappung", "Overlap"), num: true}, {text: T("Rangwert", "Rank score"), num: true}],
      rows.map((r) => ({cells: [tr(VIDEO[r.label]), String(r.chunk_size), String(r.overlap), fmt(r.mrr, 2)]})))});
}

function draw() {
  if (!live || !bench) return;
  const open = [...document.querySelectorAll("#figures details[open]")].map((d) => d.closest("figure").id);
  document.getElementById("figures").replaceChildren(liveFigure(), ragFigure(), llmFigure(), whisperFigure(),
    el("div", {class: "figure-pair"}, [bitrateFigure(), embeddingFigure()]), matrixFigure(), chunkFigure());
  for (const id of open) document.querySelector(`#${id} details`).open = true;
}

export async function mount() {
  wireTooltips(document.getElementById("figures"));
  onLang(draw);
  try {
    [live, bench] = await Promise.all([loadJson("data/live_eval.json"), loadJson("data/benchmarks.json")]);
    draw();
  } catch (error) {
    document.getElementById("figures").replaceChildren(el("p", {class: "loading", text: lang() === "de" ? "Die Messwerte konnten nicht geladen werden. Bitte die Seite neu laden." : "The measurements could not be loaded. Please reload the page."}));
    throw error;
  }
}
