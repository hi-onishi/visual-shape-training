const example = document.querySelector("#example");
const canvas = document.querySelector("#drawCanvas");
const ctx = canvas.getContext("2d");
const statusEl = document.querySelector("#status");
const historyBody = document.querySelector("#history");

let level = 1;
let mode = "shapes";
let questionNo = 0;
let drawing = false;
let startedAt = Date.now();
let paths = [];
let currentPath = [];
let records = [];
let lastRecordedQuestion = -1;

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 500;
const VIEW_HEIGHT = 340;

// 直線の向きは4種類を1セットにして、偏りを抑える
const lineDirections = ["right-up", "left-up", "horizontal", "vertical"];
let lineDirectionQueue = [];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (!rect.width || !rect.height) return;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  // 描画座標をCSSピクセル単位にそろえる
  ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
  redraw();
}

function redraw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (mode === "dots") drawDotGrid(ctx, rect.width, rect.height, level === 1 ? 6 : 8);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#18314f";
  for (const path of paths) drawPath(path);
  if (currentPath.length) drawPath(currentPath);
}

function drawPath(path) {
  if (!path.length) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.clientWidth / rect.width),
    y: (event.clientY - rect.top) * (canvas.clientHeight / rect.height)
  };
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  drawing = true;
  currentPath = [pointFromEvent(event)];
  startedAt = startedAt || Date.now();
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener("pointermove", (event) => {
  if (!drawing) return;
  event.preventDefault();
  currentPath.push(pointFromEvent(event));
  redraw();
});

function finishStroke() {
  if (!drawing) return;
  drawing = false;
  if (currentPath.length) paths.push(currentPath);
  currentPath = [];
  redraw();
}
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);
canvas.addEventListener("lostpointercapture", finishStroke);

function clearDrawing() {
  paths = [];
  currentPath = [];
  drawing = false;
  redraw();
  statusEl.textContent = "描いた線を消しました。";
}

document.querySelector("#clearBtn").addEventListener("click", clearDrawing);

function random(min, max) {
  return min + Math.random() * (max - min);
}

function makeSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  element.setAttribute("fill", "none");
  element.setAttribute("stroke", "#173b73");
  element.setAttribute("stroke-width", "4");
  element.setAttribute("stroke-linecap", "round");
  element.setAttribute("stroke-linejoin", "round");
  return element;
}

function selectedShapes() {
  return [...document.querySelectorAll('input[name="shape"]:checked')]
    .map((input) => input.value);
}

function nextLineDirection() {
  if (lineDirectionQueue.length === 0) {
    lineDirectionQueue = [...lineDirections];
    // 4方向の順番だけをシャッフルし、4本ごとに各方向が1回ずつ出るようにする
    for (let i = lineDirectionQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lineDirectionQueue[i], lineDirectionQueue[j]] = [lineDirectionQueue[j], lineDirectionQueue[i]];
    }
  }
  return lineDirectionQueue.pop();
}

function makeLine(margin) {
  const direction = nextLineDirection();
  let angle;

  // SVG座標ではYが下向き。right-up は左下から右上へ向かう線
  if (direction === "right-up") angle = -Math.PI / 4;
  else if (direction === "left-up") angle = Math.PI / 4;
  else if (direction === "horizontal") angle = 0;
  else angle = Math.PI / 2;

  // キャンバス内に収まる最大長を求め、その30〜80%を採用する
  const halfWidth = VIEW_WIDTH / 2 - margin;
  const halfHeight = VIEW_HEIGHT / 2 - margin;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const maxLengthByWidth = cos === 0 ? Infinity : (2 * halfWidth) / cos;
  const maxLengthByHeight = sin === 0 ? Infinity : (2 * halfHeight) / sin;
  const maxLength = Math.min(maxLengthByWidth, maxLengthByHeight);
  const length = random(maxLength * 0.3, maxLength * 0.8);
  const centerX = random(margin + (length * cos) / 2, VIEW_WIDTH - margin - (length * cos) / 2);
  const centerY = random(margin + (length * sin) / 2, VIEW_HEIGHT - margin - (length * sin) / 2);
  const dx = Math.cos(angle) * length / 2;
  const dy = Math.sin(angle) * length / 2;

  return makeSvgElement("line", {
    x1: centerX - dx, y1: centerY - dy,
    x2: centerX + dx, y2: centerY + dy
  });
}

const modeCopy = {
  shapes: {
    exampleTitle: "見本の図形", exampleHint: "見本の形・位置・大きさをよく観察しましょう。",
    drawingTitle: "あなたの描く図形", drawingHint: "見本を見ながら、同じように描いてみましょう。"
  },
  lines: {
    exampleTitle: "見本の直線", exampleHint: "線の長さと向きをよく見て、同じように描きましょう。",
    drawingTitle: "直線を描く", drawingHint: "短い線から長い線まで、見本に合わせて描きましょう。"
  },
  dots: {
    exampleTitle: "点つなぎの見本", exampleHint: "格子の点を使った完成図を見て、同じ形を描き写しましょう。",
    drawingTitle: "点を使って描く", drawingHint: "見本と同じ格子の点を目安にして、絵を描き写しましょう。"
  }
};

// SVG図案の一覧です。level 1は6×6、level 2・3は8×8から選びます。
// 新しいSVGを追加したら、この一覧にもファイル名・難易度を登録してください。
const dotPictures = [
  { name: "おうち", file: "pictures/house-6.svg", grid: 6, level: 1 },
  { name: "おさかな", file: "pictures/fish-6.svg", grid: 6, level: 1 },
  { name: "やま", file: "pictures/mountain-6.svg", grid: 6, level: 1 },
  { name: "おうち", file: "pictures/house-8.svg", grid: 8, level: 2 },
  { name: "おさかな", file: "pictures/fish-8.svg", grid: 8, level: 2 },
  { name: "おはな", file: "pictures/flower-8.svg", grid: 8, level: 2 }
];

const GRID = { x1: 60, x2: 440, y1: 40, y2: 300 };

function gridPosition(column, row, columns, rows, width, height) {
  return {
    x: (GRID.x1 + (GRID.x2 - GRID.x1) * column / (columns - 1)) * width / VIEW_WIDTH,
    y: (GRID.y1 + (GRID.y2 - GRID.y1) * row / (rows - 1)) * height / VIEW_HEIGHT
  };
}

function drawDotGrid(context, width, height, count) {
  context.save();
  context.fillStyle = "#9bb6d5";
  const radius = Math.max(1.8, Math.min(width / 180, 3));
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      const point = gridPosition(column, row, count, count, width, height);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function applyModeText() {
  const copy = modeCopy[mode];
  document.querySelector("#exampleTitle").textContent = copy.exampleTitle;
  document.querySelector("#exampleHint").textContent = copy.exampleHint;
  document.querySelector("#drawingTitle").textContent = copy.drawingTitle;
  document.querySelector("#drawingHint").textContent = copy.drawingHint;
  document.querySelector("#shapeSettings").hidden = mode !== "shapes";
  document.querySelector("#countSettings").hidden = mode !== "shapes";
  document.querySelector("#settingsHint").textContent = mode === "dots"
    ? "かんたんは6×6、ふつう・むずかしいは8×8のドットを表示します。同じ難易度の絵からランダムに選びます。"
    : mode === "lines" ? "直線の長さと向きは自動で変わります。"
    : "図形の種類や数を変えて「次の問題」を押してください。";
}

function generateDotQuestion() {
  // 難易度1は6×6、難易度2・3は8×8に固定します。
  const gridCount = level === 1 ? 6 : 8;
  const pictureLevel = gridCount === 6 ? 1 : 2;
  const candidates = dotPictures.filter((picture) => picture.level === pictureLevel);
  const picture = candidates[Math.floor(Math.random() * candidates.length)];

  // 見本にも6×6または8×8のドット格子を表示
  const gridGroup = document.createElementNS(SVG_NS, "g");
  gridGroup.setAttribute("fill", "#9bb6d5");
  for (let row = 0; row < gridCount; row++) {
    for (let column = 0; column < gridCount; column++) {
      const point = gridPosition(column, row, gridCount, gridCount, VIEW_WIDTH, VIEW_HEIGHT);
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", point.x);
      dot.setAttribute("cy", point.y);
      dot.setAttribute("r", "3");
      gridGroup.appendChild(dot);
    }
  }
  example.appendChild(gridGroup);

  // 別ファイルのSVGを、見本エリアと同じ座標系で重ねて表示します。
  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", picture.file);
  image.setAttribute("x", "0");
  image.setAttribute("y", "0");
  image.setAttribute("width", String(VIEW_WIDTH));
  image.setAttribute("height", String(VIEW_HEIGHT));
  image.setAttribute("preserveAspectRatio", "none");
  example.appendChild(image);

  statusEl.textContent = `完成図「${picture.name}」を表示しました（${gridCount}×${gridCount}ドット）。同じ格子を使って描き写してください。`;
}

function generateQuestion() {
  const choices = mode === "shapes" ? selectedShapes() : mode === "lines" ? ["line"] : [];
  if (mode === "shapes" && !choices.length) {
    statusEl.textContent = "図形の種類を1つ以上選んでください。";
    return;
  }

  example.replaceChildren();
  clearDrawing();
  questionNo += 1;
  lastRecordedQuestion = -1;
  startedAt = Date.now();

  const requestedCount = Number(document.querySelector("#count").value);
  const count = Math.min(requestedCount + level - 1, 6);
  const margin = level === 1 ? 60 : level === 2 ? 45 : 35;

  if (mode === "dots") {
    generateDotQuestion();
    return;
  }

  for (let i = 0; i < count; i++) {
    let type = choices[Math.floor(Math.random() * choices.length)];
    if (type === "line" && !choices.includes("line")) type = choices[0];

    const x = random(margin, VIEW_WIDTH - margin);
    const y = random(margin, VIEW_HEIGHT - margin);
    const size = random(level === 1 ? 18 : 14, level === 3 ? 42 : 34);
    let shape;

    if (type === "circle") {
      shape = makeSvgElement("circle", {
        cx: x, cy: y, r: size * 0.65
      });
    } else if (type === "triangle") {
      shape = makeSvgElement("polygon", {
        points: `${x},${y - size} ${x + size},${y + size * 0.7} ${x - size},${y + size * 0.7}`
      });
    } else if (type === "square") {
      const half = size * 0.7;
      const rotation = level === 3 ? random(-25, 25) : 0;
      shape = makeSvgElement("rect", {
        x: x - half, y: y - half, width: half * 2, height: half * 2,
        transform: `rotate(${rotation} ${x} ${y})`
      });
    } else {
      shape = makeLine(margin);
    }
    example.appendChild(shape);
  }
  statusEl.textContent = mode === "lines"
    ? `直線の問題 ${questionNo} です。描き終わったら「記録する」を押してください。`
    : `問題 ${questionNo} を表示しました。描き終わったら「記録する」を押してください。`;
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((other) => {
      other.setAttribute("aria-pressed", String(other === button));
    });
    applyModeText();
    generateQuestion();
  });
});

document.querySelectorAll("[data-level]").forEach((button) => {
  button.addEventListener("click", () => {
    level = Number(button.dataset.level);
    document.querySelectorAll("[data-level]").forEach((other) => {
      other.setAttribute("aria-pressed", String(other === button));
    });
    generateQuestion();
  });
});

document.querySelector("#nextBtn").addEventListener("click", generateQuestion);

document.querySelector("#recordBtn").addEventListener("click", () => {
  if (lastRecordedQuestion === questionNo) {
    statusEl.textContent = "この問題はすでに記録済みです。次の問題に進んでください。";
    return;
  }
  const seconds = Math.max(0, (Date.now() - startedAt) / 1000);
  const record = {
    date: new Date().toLocaleString("ja-JP"),
    question: questionNo,
    seconds: seconds.toFixed(1)
  };
  records.unshift(record);
  lastRecordedQuestion = questionNo;
  renderHistory();
  statusEl.textContent = `描画時間 ${record.seconds} 秒をこの端末に記録しました。`;
});

function renderHistory() {
  historyBody.replaceChildren();
  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "まだ記録はありません";
    row.appendChild(cell);
    historyBody.appendChild(row);
    return;
  }

  records.slice(0, 8).forEach((record) => {
    const row = document.createElement("tr");
    [record.date, `Q${record.question}`, `${record.seconds} 秒`].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    historyBody.appendChild(row);
  });
}

document.querySelector("#saveBtn").addEventListener("click", () => {
  if (!records.length) {
    statusEl.textContent = "保存する記録がありません。";
    return;
  }
  const header = ["日時", "問題番号", "描画時間（秒）"];
  const rows = records.map((record) => [record.date, record.question, record.seconds]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "training-records.csv";
  link.click();
  URL.revokeObjectURL(url);
  statusEl.textContent = "CSVファイルをダウンロードしました。";
});

if ("ResizeObserver" in window) {
  new ResizeObserver(resizeCanvas).observe(canvas);
} else {
  window.addEventListener("resize", resizeCanvas);
}
window.addEventListener("orientationchange", resizeCanvas);

resizeCanvas();
applyModeText();
generateQuestion();
