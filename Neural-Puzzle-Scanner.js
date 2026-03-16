
const canvasSketch = require("canvas-sketch");
const Tweakpane = require("tweakpane");

const settings = {
  dimensions: [1080, 1080],
  animate: true
};

let video;
let hands;
let rightHand = null;
let sketchCanvas = null;

const GRID = 4;
const cellSize = 250;
const offset = 40;

let cells = [];
let selected = null;
let fingerX = 0;
let fingerY = 0;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

const params = { bgBlur: 20 };
const pane = new Tweakpane.Pane();
pane.addInput(params, "bgBlur", { min: 0, max: 40, step: 1, label: "BG Blur" });


const loadScript = (src) =>
  new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.body.appendChild(s);
  });

const loadMediaPipe = async () => {
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
};

function initGrid() {
  cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      cells.push({
        gridRow: r,
        gridCol: c,
        imgRow: r,
        imgCol: c,
        x: c * cellSize + offset,
        y: r * cellSize + offset,
        w: cellSize - 10,
        h: cellSize - 10
      });
    }
  }
}

function drawEye(ctx, x, y, targetX, targetY) {
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = x + (dx / dist) * 6;
  const py = y + (dy / dist) * 6;

  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
}

function swapCell(cell, x, y) {
  const col = Math.floor((x - offset) / cellSize);
  const row = Math.floor((y - offset) / cellSize);
  const other = cells.find((c) => c.gridRow === row && c.gridCol === col);

  if (!other || other === cell) {
    cell.x = cell.gridCol * cellSize + offset;
    cell.y = cell.gridRow * cellSize + offset;
    return;
  }

  const oldRow = cell.imgRow;
  const oldCol = cell.imgCol;

  cell.imgRow = other.imgRow;
  cell.imgCol = other.imgCol;
  other.imgRow = oldRow;
  other.imgCol = oldCol;

  cell.x = cell.gridCol * cellSize + offset;
  cell.y = cell.gridRow * cellSize + offset;
}

function forceDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function savePNG() {
  if (!sketchCanvas) {
    console.log("Canvas belum siap");
    return;
  }

  try {
    const url = sketchCanvas.toDataURL("image/png");
    forceDownload(url, `puzzle-${Date.now()}.png`);
    console.log("PNG SAVED");
  } catch (err) {
    console.error("Gagal save PNG:", err);
  }
}

function startRecording() {
  if (!sketchCanvas) {
    console.log("Canvas belum siap");
    return;
  }

  if (isRecording) {
    console.log("Sudah recording");
    return;
  }

  const stream = sketchCanvas.captureStream(30);
  recordedChunks = [];

  let options = {};
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    options.mimeType = "video/webm;codecs=vp9";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    options.mimeType = "video/webm;codecs=vp8";
  } else if (MediaRecorder.isTypeSupported("video/webm")) {
    options.mimeType = "video/webm";
  }

  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    if (!recordedChunks.length) {
      console.log("Tidak ada data video yang terekam");
      return;
    }

    const blob = new Blob(recordedChunks, {
      type: options.mimeType || "video/webm"
    });

    const url = URL.createObjectURL(blob);
    forceDownload(url, `recording-${Date.now()}.webm`);
    console.log("VIDEO SAVED");

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);
  };

  mediaRecorder.start();
  isRecording = true;
  console.log("RECORD START");
}

function stopRecording() {
  if (!mediaRecorder || !isRecording) {
    console.log("Belum recording");
    return;
  }

  mediaRecorder.stop();
  isRecording = false;
  console.log("RECORD STOP");
}

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "p") {
    e.preventDefault();
    savePNG();
  }

  if (key === "r") {
    e.preventDefault();
    startRecording();
  }

  if (key === "s") {
    e.preventDefault();
    stopRecording();
  }
});

const sketch = ({ width, height, canvas }) => {
  sketchCanvas = canvas;
  initGrid();

  hands = new window.Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults((res) => {
    rightHand = null;

    if (res.multiHandLandmarks && res.multiHandedness) {
      res.multiHandLandmarks.forEach((lm, i) => {
        const label = res.multiHandedness[i].label;
        if (label === "Left") rightHand = lm;
      });
    }
  });

  const camera = new window.Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });

  camera.start();

  return ({ context }) => {
    if (!video || !video.videoWidth) return;

    context.clearRect(0, 0, width, height);

    // ================= BG HITAM PUTIH =================
    context.filter = `grayscale(100%) blur(${params.bgBlur}px)`;
    context.drawImage(video, 0, 0, width, height);
    context.filter = "none";

   
    const cropW = video.videoWidth / GRID;
    const cropH = video.videoHeight / GRID;

    cells.forEach((cell) => {
      if (cell === selected) return;

      const sx = cell.imgCol * cropW;
      const sy = cell.imgRow * cropH;

      context.drawImage(
        video,
        sx,
        sy,
        cropW,
        cropH,
        cell.x,
        cell.y,
        cell.w,
        cell.h
      );

      context.strokeStyle = "white";
      context.lineWidth = 3;
      context.strokeRect(cell.x, cell.y, cell.w, cell.h);
    });
    

    if (selected) {
      const sx = selected.imgCol * cropW;
      const sy = selected.imgRow * cropH;

      context.drawImage(
        video,
        sx,
        sy,
        cropW,
        cropH,
        selected.x,
        selected.y,
        selected.w,
        selected.h
      );

      context.strokeStyle = "yellow";
      context.lineWidth = 5;
      context.strokeRect(selected.x, selected.y, selected.w, selected.h);

      drawEye(
        context,
        selected.x + selected.w / 2,
        selected.y + selected.h / 2,
        fingerX,
        fingerY
      );
    }

   
    if (rightHand) {
      const index = rightHand[8];
      const thumb = rightHand[4];

      const x = index.x * width;
      const y = index.y * height;

      fingerX = x;
      fingerY = y;

      const dx = (index.x - thumb.x) * width;
      const dy = (index.y - thumb.y) * height;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pinch = dist < 120;

      if (pinch && !selected) {
        for (const cell of cells) {
          if (
            x > cell.x &&
            x < cell.x + cell.w &&
            y > cell.y &&
            y < cell.y + cell.h
          ) {
            selected = cell;
            break;
          }
        }
      }

      if (selected && pinch) {
        selected.x = x - selected.w / 2;
        selected.y = y - selected.h / 2;
      }

      if (selected && !pinch) {
        swapCell(selected, x, y);
        selected = null;
      }

      context.fillStyle = "red";
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.fill();
    }

    if (isRecording) {
      context.fillStyle = "red";
      context.font = "bold 28px monospace";
      context.fillText("● REC", width - 130, 40);
    }
  };
};


const setupWebcam = async () => {
  video = document.createElement("video");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  video.srcObject = stream;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
};


const start = async () => {
  await loadMediaPipe();
  await setupWebcam();
  await canvasSketch(sketch, settings);
};

start();