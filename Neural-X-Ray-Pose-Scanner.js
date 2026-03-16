import canvasSketch from "canvas-sketch";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import { Pose } from "@mediapipe/pose";
import { Pane } from "tweakpane";

const settings = {
  dimensions: [1080, 1080],
  animate: true
};

let video;
let segmentation;
let pose;
let poseLandmarks = null;

let maskCanvas;
let maskCtx;

let blinkCanvas;
let blinkCtx;

let auraCanvas;
let auraCtx;

let frameCache = [];
const cacheSize = 20;

// AUDIO
let audio;
let audioCtx;
let analyser;
let dataArray;

const beatThreshold = 170;

const colors = [
  "#ff0077",
  "#00ffff",
  "#ffff00",
  "#00ff88",
  "#ff00ff"
];

// PARAMS
const params = {
  stopInterval: 0.35,
  boneSize: 7,
  boneWidth: 6,
  boneGlow: 18,
  boneColor: "#ff3355",
  boneAlpha: 0.95,
  curveBend: 0.16,
  xrayCore: true
};

let lastCaptureTime = 0;

const POSE_CONNECTIONS = {
  torso: [
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24]
  ],
  limbs: [
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28]
  ],
  small: [
    [27, 29],
    [29, 31],
    [28, 30],
    [30, 32],
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [4, 5],
    [5, 6],
    [9, 10]
  ]
};

function getPoint(lm, width, height) {
  return {
    x: lm.x * width,
    y: lm.y * height,
    v: lm.visibility ?? 1
  };
}

function drawCurvedBone(ctx, a, b, width, color, alpha, glow, bend = 0.16) {
  const mx = (a.x + b.x) * 0.5;
  const my = (a.y + b.y) * 0.5;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const nx = -dy / dist;
  const ny = dx / dist;

  const dir = Math.sin((a.x + a.y + b.x + b.y) * 0.01) > 0 ? 1 : -1;
  const curveAmount = dist * bend * dir;

  const cx = mx + nx * curveAmount;
  const cy = my + ny * curveAmount;

  if (params.xrayCore) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = width + 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = glow * 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = width + 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = glow * 1.2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawOrganicJoint(ctx, p, radius, color, alpha, glow) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;

  const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.4);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.2, color);
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPoseSkeleton(ctx, landmarks, width, height) {
  if (!landmarks || !landmarks.length) return;

  const pts = landmarks.map((lm) => getPoint(lm, width, height));

  const drawGroup = (connections, lineWidth, alphaMul, glowMul, bendMul) => {
    for (const [aIdx, bIdx] of connections) {
      const a = pts[aIdx];
      const b = pts[bIdx];
      if (!a || !b) continue;
      if (a.v < 0.35 || b.v < 0.35) continue;

      drawCurvedBone(
        ctx,
        a,
        b,
        lineWidth,
        params.boneColor,
        params.boneAlpha * alphaMul,
        params.boneGlow * glowMul,
        params.curveBend * bendMul
      );
    }
  };

  drawGroup(POSE_CONNECTIONS.torso, params.boneWidth + 4, 1, 1.1, 0.55);
  drawGroup(POSE_CONNECTIONS.limbs, params.boneWidth, 1, 1, 1);
  drawGroup(
    POSE_CONNECTIONS.small,
    Math.max(2, params.boneWidth - 2),
    0.8,
    0.8,
    0.8
  );

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p || p.v < 0.35) continue;

    let r = params.boneSize;

    if ([11, 12, 23, 24].includes(i)) r = params.boneSize + 3;
    else if ([13, 14, 25, 26].includes(i)) r = params.boneSize + 1.5;
    else if ([15, 16, 27, 28].includes(i)) r = params.boneSize;

    drawOrganicJoint(
      ctx,
      p,
      r,
      params.boneColor,
      params.boneAlpha,
      params.boneGlow
    );
  }
}

const sketch = ({ width, height }) => {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

  maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

  blinkCanvas = document.createElement("canvas");
  blinkCanvas.width = width;
  blinkCanvas.height = height;
  blinkCtx = blinkCanvas.getContext("2d", { willReadFrequently: true });

  auraCanvas = document.createElement("canvas");
  auraCanvas.width = width;
  auraCanvas.height = height;
  auraCtx = auraCanvas.getContext("2d", { willReadFrequently: true });

  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = width;
  hudCanvas.height = height;
  const hudCtx = hudCanvas.getContext("2d");

  segmentation = new SelfieSegmentation({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });

  segmentation.setOptions({ modelSelection: 1 });

  segmentation.onResults((results) => {
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.drawImage(results.segmentationMask, 0, 0, width, height);
  });

  pose = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  pose.onResults((results) => {
    poseLandmarks = results.poseLandmarks || null;
  });

  const runMediaPipe = async () => {
    if (video && video.readyState >= 2) {
      await segmentation.send({ image: video });
      await pose.send({ image: video });
    }
    requestAnimationFrame(runMediaPipe);
  };
  runMediaPipe();

  const pane = new Pane();
  pane.addInput(params, "stopInterval", {
    min: 0.05,
    max: 1,
    step: 0.01,
    label: "Slow Motion"
  });
  pane.addInput(params, "boneSize", {
    min: 2,
    max: 20,
    step: 1,
    label: "Bone Joint Size"
  });
  pane.addInput(params, "boneWidth", {
    min: 1,
    max: 20,
    step: 1,
    label: "Bone Width"
  });
  pane.addInput(params, "boneGlow", {
    min: 0,
    max: 50,
    step: 1,
    label: "Bone Glow"
  });
  pane.addInput(params, "boneAlpha", {
    min: 0.1,
    max: 1,
    step: 0.01,
    label: "Bone Alpha"
  });
  pane.addInput(params, "curveBend", {
    min: 0.02,
    max: 0.4,
    step: 0.01,
    label: "Bone Curve"
  });
  pane.addInput(params, "boneColor", {
    label: "Bone Color"
  });
  pane.addInput(params, "xrayCore", {
    label: "Xray Core"
  });

  return ({ context, time }) => {
    if (!video) return;

    context.clearRect(0, 0, width, height);

    offCtx.clearRect(0, 0, width, height);
    offCtx.drawImage(video, 0, 0, width, height);

    let frame = offCtx.getImageData(0, 0, width, height);
    let pixels = frame.data;

    // CARTOON
    let levels = 5;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = Math.floor((pixels[i] / 255) * levels) * (255 / levels);
      pixels[i + 1] =
        Math.floor((pixels[i + 1] / 255) * levels) * (255 / levels);
      pixels[i + 2] =
        Math.floor((pixels[i + 2] / 255) * levels) * (255 / levels);
    }

    // EDGE
    const edgePixels = new Uint8ClampedArray(pixels);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const iRight = (y * width + (x + 1)) * 4;
        const iDown = ((y + 1) * width + x) * 4;

        const dx =
          Math.abs(pixels[i] - pixels[iRight]) +
          Math.abs(pixels[i + 1] - pixels[iRight + 1]) +
          Math.abs(pixels[i + 2] - pixels[iRight + 2]);

        const dy =
          Math.abs(pixels[i] - pixels[iDown]) +
          Math.abs(pixels[i + 1] - pixels[iDown + 1]) +
          Math.abs(pixels[i + 2] - pixels[iDown + 2]);

        const edge = dx + dy > 50 ? 0 : 255;

        edgePixels[i] = edge;
        edgePixels[i + 1] = edge;
        edgePixels[i + 2] = edge;
      }
    }

    offCtx.putImageData(new ImageData(edgePixels, width, height), 0, 0);

    // MASK BODY
    offCtx.globalCompositeOperation = "destination-in";
    offCtx.drawImage(maskCanvas, 0, 0, width, height);
    offCtx.globalCompositeOperation = "source-over";

    offCtx.save();
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = "#ff0077";
    offCtx.fillRect(0, 0, width, height);
    offCtx.restore();

    // STOP MOTION
    if (time - lastCaptureTime > params.stopInterval) {
      lastCaptureTime = time;
      frameCache.push(offCtx.getImageData(0, 0, width, height));
      if (frameCache.length > cacheSize) frameCache.shift();
    }

    const outFrame = frameCache[frameCache.length - 1];
    let bass = 0;

    if (outFrame) {
      if (frameCache.length > 1) {
        context.save();
        context.globalAlpha = 0.18;
        context.filter = "blur(14px)";
        context.drawImage(maskCanvas, 18, 18, width, height);
        context.restore();
      }

      context.putImageData(outFrame, 0, 0);

      analyser.getByteFrequencyData(dataArray);
      bass = 0;
      for (let i = 0; i < 10; i++) bass += dataArray[i];
      bass /= 10;
      const beat = bass > beatThreshold;

      // BLINK
      if (beat) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        blinkCtx.clearRect(0, 0, width, height);
        blinkCtx.fillStyle = color;
        blinkCtx.fillRect(0, 0, width, height);

        blinkCtx.globalCompositeOperation = "destination-in";
        blinkCtx.drawImage(maskCanvas, 0, 0, width, height);
        blinkCtx.globalCompositeOperation = "source-over";

        context.save();
        context.globalCompositeOperation = "screen";
        context.globalAlpha = 0.7;
        context.drawImage(blinkCanvas, 0, 0);
        context.restore();
      }

      // AURA
      auraCtx.clearRect(0, 0, width, height);
      const intensity = bass / 255;
      const expand = 40 + 80 * intensity;

      auraCtx.drawImage(
        maskCanvas,
        -expand,
        -expand,
        width + expand * 2,
        height + expand * 2
      );
      auraCtx.globalCompositeOperation = "destination-out";
      auraCtx.drawImage(maskCanvas, 0, 0, width, height);

      auraCtx.globalCompositeOperation = "source-over";
      auraCtx.filter = "blur(12px)";
      const grad = auraCtx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#ffffaa");
      grad.addColorStop(0.3, "#ffcc00");
      grad.addColorStop(0.6, "#ff5500");
      grad.addColorStop(1, "#ff0000");

      auraCtx.globalCompositeOperation = "source-in";
      auraCtx.fillStyle = grad;
      auraCtx.fillRect(0, 0, width, height);
      auraCtx.filter = "none";

      context.save();
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = 0.9;
      context.drawImage(auraCanvas, 0, 0);
      context.restore();

      // ORGANIC BONE
      context.save();
      context.globalCompositeOperation = "screen";
      drawPoseSkeleton(context, poseLandmarks, width, height);
      context.restore();
    }

    // HUD
    hudCtx.clearRect(0, 0, width, height);
    hudCtx.save();
    hudCtx.globalAlpha = 0.38;
    hudCtx.fillStyle = "black";
    hudCtx.fillRect(12, 12, 290, 110);
    hudCtx.globalAlpha = 1;
    hudCtx.font = "30px Arial";
    hudCtx.fillStyle = "white";
    hudCtx.textAlign = "left";
    hudCtx.textBaseline = "top";
    hudCtx.fillText("Score: 12345", 22, 20);
    hudCtx.fillText("Bass: " + Math.floor(bass), 22, 52);
    hudCtx.fillText("Bones: CURVED", 22, 84);
    hudCtx.restore();

    context.drawImage(hudCanvas, 0, 0);
  };
};

// WEBCAM
const setupWebcam = async () => {
  video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
};

// AUDIO
const setupAudio = async () => {
  audio = new Audio("audio/hindia.mp3");
  audio.loop = true;
  audio.crossOrigin = "anonymous";

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audio);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  await audio.play();
};

// START
const start = async () => {
  await setupWebcam();
  await setupAudio();
  canvasSketch(sketch, settings);
};

start();