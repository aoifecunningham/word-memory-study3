"use strict";

const WORD_LISTS = [
  ["apple", "hammer", "river", "candle", "rabbit", "bottle"],
  ["window", "lemon", "ladder", "turtle", "pillow", "garden"],
  ["coin", "basket", "cloud", "guitar", "button", "bridge"]
];

const STRATEGIES = [
  {
    key: "maintenance_rehearsal",
    label: "Maintenance rehearsal",
    instructions: "Repeat the word silently to yourself. Focus on keeping the word active in your mind by saying it over and over."
  },
  {
    key: "self_reference",
    label: "Self-reference",
    instructions: "Think about how the word relates to you personally. Ask yourself whether you own, use, like, or have an experience involving this thing."
  },
  {
    key: "mental_imagery",
    label: "Mental imagery",
    instructions: "Create a clear mental picture of the thing the word represents. Imagine its shape, color, size, and details."
  }
];

const WORD_DURATION_MS = 3000;
const DISTRACTOR_DURATION_SECONDS = 30;
const screens = ["welcome-screen", "instruction-screen", "study-screen", "distractor-screen", "recall-screen", "results-screen"];
const $ = id => document.getElementById(id);

let session = null;
let blockIndex = 0;
let wordIndex = 0;
let distractorInterval = null;
let currentBlock = null;
let trialRows = [];

function showScreen(id) {
  screens.forEach(screenId => $(screenId).classList.toggle("hidden", screenId !== id));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeSession() {
  const randomizedStrategies = shuffle(STRATEGIES);
  const randomizedLists = shuffle(WORD_LISTS.map((words, index) => ({ listId: index + 1, words })));
  const blocks = randomizedStrategies.map((strategy, index) => ({
    strategy, listId: randomizedLists[index].listId, words: randomizedLists[index].words
  }));
  return {
    sessionId: `S${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    participantId: $("participant-id").value.trim(),
    startedAt: new Date().toISOString(),
    blocks,
    distractorStart: null,
    distractorResponse: "",
    recallResponse: "",
    completedAt: null
  };
}

function startExperiment() {
  if (distractorInterval) clearInterval(distractorInterval);
  session = makeSession();
  blockIndex = 0;
  wordIndex = 0;
  trialRows = [];
  session.blocks.forEach((block, bIndex) => {
    block.words.forEach((word, wIndex) => {
      trialRows.push({
        session_id: session.sessionId,
        participant_id: session.participantId,
        block_order: bIndex + 1,
        word_order_in_block: wIndex + 1,
        strategy: block.strategy.key,
        strategy_label: block.strategy.label,
        word_list: block.listId,
        word,
        recalled: false,
        matched_response: ""
      });
    });
  });
  showInstruction();
}

function showInstruction() {
  currentBlock = session.blocks[blockIndex];
  $("block-counter").textContent = `BLOCK ${blockIndex + 1} OF 3`;
  $("strategy-title").textContent = currentBlock.strategy.label;
  $("strategy-instructions").textContent = currentBlock.strategy.instructions;
  showScreen("instruction-screen");
}

function beginBlock() {
  wordIndex = 0;
  showScreen("study-screen");
  showNextWord();
}

function showNextWord() {
  if (wordIndex >= currentBlock.words.length) {
    blockIndex++;
    if (blockIndex < session.blocks.length) showInstruction();
    else beginDistractor();
    return;
  }
  $("study-progress").textContent = `WORD ${wordIndex + 1} OF 6`;
  $("word-display").textContent = currentBlock.words[wordIndex];
  setTimeout(() => {
    wordIndex++;
    showNextWord();
  }, WORD_DURATION_MS);
}

function beginDistractor() {
  session.distractorStart = Math.floor(100 + Math.random() * 900);
  $("starting-number").textContent = session.distractorStart;
  $("counting-response").value = "";
  $("timer").textContent = DISTRACTOR_DURATION_SECONDS;
  showScreen("distractor-screen");
  let remaining = DISTRACTOR_DURATION_SECONDS;
  distractorInterval = setInterval(() => {
    remaining--;
    $("timer").textContent = remaining;
    if (remaining <= 0) {
      clearInterval(distractorInterval);
      distractorInterval = null;
      session.distractorResponse = $("counting-response").value;
      showScreen("recall-screen");
    }
  }, 1000);
}

function normalizeWord(value) {
  return value.toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return row[b.length];
}

function isAcceptableSpelling(response, target) {
  const a = normalizeWord(response);
  const b = normalizeWord(target);
  if (!a || !b) return false;
  if (a === b) return true;
  return levenshtein(a, b) <= (b.length >= 7 ? 2 : 1);
}

function tokenizeRecall(raw) {
  return raw.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
}

function scoreRecall() {
  const responses = tokenizeRecall($("recall-response").value);
  const unmatchedTrials = new Set(trialRows.map((_, index) => index));
  const usedResponses = new Set();

  responses.forEach(response => {
    const normalizedResponse = normalizeWord(response);
    if (!normalizedResponse || usedResponses.has(normalizedResponse)) return;
    const candidates = [...unmatchedTrials].filter(index =>
      isAcceptableSpelling(response, trialRows[index].word)
    );
    candidates.sort((a, b) => {
      const exactA = normalizedResponse === normalizeWord(trialRows[a].word) ? 0 : 1;
      const exactB = normalizedResponse === normalizeWord(trialRows[b].word) ? 0 : 1;
      return exactA - exactB;
    });
    if (candidates.length) {
      const matchIndex = candidates[0];
      trialRows[matchIndex].recalled = true;
      trialRows[matchIndex].matched_response = response;
      unmatchedTrials.delete(matchIndex);
      usedResponses.add(normalizedResponse);
    }
  });

  session.recallResponse = $("recall-response").value;
  session.completedAt = new Date().toISOString();
  showResults();
}

function showResults() {
  const total = trialRows.filter(row => row.recalled).length;
  $("overall-score").innerHTML = `<span class="result-total"><strong>${total} of 18 words recalled</strong> (${Math.round(total / 18 * 100)}%)</span>`;
  const resultContainer = $("strategy-results");
  resultContainer.innerHTML = "";

  const comparison = document.createElement("div");
  comparison.className = "result-comparison";
  const title = document.createElement("h3");
  title.textContent = "Recall by encoding strategy";
  comparison.appendChild(title);

  session.blocks.forEach(block => {
    const rows = trialRows.filter(row => row.strategy === block.strategy.key);
    const count = rows.filter(row => row.recalled).length;
    const percent = Math.round(count / 6 * 100);

    const row = document.createElement("div");
    row.className = "bar-row";
    const name = document.createElement("span");
    name.className = "bar-label";
    name.textContent = block.strategy.label;

    const track = document.createElement("div");
    track.className = "bar-track";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${block.strategy.label}: ${count} of 6 words recalled`);

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${percent}%`;
    track.appendChild(fill);

    const score = document.createElement("strong");
    score.className = "bar-value";
    score.textContent = `${count}/6`;
    row.append(name, track, score);
    comparison.appendChild(row);
  });

  const note = document.createElement("p");
  note.className = "chart-note";
  note.textContent = "Each bar represents the percentage of the six words recalled for that strategy.";
  comparison.appendChild(note);
  resultContainer.appendChild(comparison);
  showScreen("results-screen");
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSummary() {
  const counts = {};
  STRATEGIES.forEach(strategy => {
    counts[strategy.key] = trialRows.filter(row => row.strategy === strategy.key && row.recalled).length;
  });
  const headers = [
    "session_id", "participant_id", "started_at", "completed_at",
    "block_1_strategy", "block_1_word_list", "block_2_strategy", "block_2_word_list",
    "block_3_strategy", "block_3_word_list",
    "maintenance_rehearsal_recalled", "self_reference_recalled", "mental_imagery_recalled",
    "total_recalled", "total_studied", "distractor_start_number", "distractor_response", "recall_response"
  ];
  const row = [
    session.sessionId, session.participantId, session.startedAt, session.completedAt,
    ...session.blocks.flatMap(block => [block.strategy.key, block.listId]),
    counts.maintenance_rehearsal, counts.self_reference, counts.mental_imagery,
    trialRows.filter(trial => trial.recalled).length, 18,
    session.distractorStart, session.distractorResponse, session.recallResponse
  ];
  downloadCsv(`memory_study_summary_${session.sessionId}.csv`, headers, [row]);
}

function downloadTrials() {
  const headers = [
    "session_id", "participant_id", "block_order", "word_order_in_block",
    "strategy", "strategy_label", "word_list", "word", "recalled", "matched_response"
  ];
  const rows = trialRows.map(row => headers.map(header => row[header]));
  downloadCsv(`memory_study_trials_${session.sessionId}.csv`, headers, rows);
}

function restart() {
  $("recall-response").value = "";
  $("counting-response").value = "";
  startExperiment();
}

$("start-button").addEventListener("click", startExperiment);
$("begin-block-button").addEventListener("click", beginBlock);
$("submit-recall-button").addEventListener("click", scoreRecall);
$("summary-download-button").addEventListener("click", downloadSummary);
$("trials-download-button").addEventListener("click", downloadTrials);
$("restart-button").addEventListener("click", restart);
