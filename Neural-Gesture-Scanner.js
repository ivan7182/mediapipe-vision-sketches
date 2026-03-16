
const canvasSketch = require('canvas-sketch');
const { Pane } = require('tweakpane');

const settings = {
  dimensions: [1080, 1080],
  animate: true
};

let video;
let hands;
let handLandmarks = [];

let depth = 1;
let targetDepth = 1;
let flip = 1;

let planes = [];

const params = {
  planeCount: 20,
  baseSize: 160,
  blurAmount: 6,
  contrast: 130,
  smoothness: 0.08,
  disappearStrength: 500 
};


const loadScript = src =>
  new Promise(resolve => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    document.body.appendChild(s);
  });

const loadMediaPipe = async () => {
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
};
 
function countFingers(landmarks) {
  let count = 0;
  if (landmarks[4].x < landmarks[3].x) count++;
  if (landmarks[8].y < landmarks[6].y) count++;
  if (landmarks[12].y < landmarks[10].y) count++;
  if (landmarks[16].y < landmarks[14].y) count++;
  if (landmarks[20].y < landmarks[18].y) count++;
  return count;
}

const sketch = ({ width, height }) => {
  const pane = new Pane();
  pane.addInput(params, 'planeCount', { min: 5, max: 50 });
  pane.addInput(params, 'baseSize', { min: 80, max: 300 });
  pane.addInput(params, 'blurAmount', { min: 0, max: 20 });
  pane.addInput(params, 'contrast', { min: 80, max: 200 });
  pane.addInput(params, 'smoothness', { min: 0.02, max: 0.2 });
  pane.addInput(params, 'disappearStrength', { min: 100, max: 1000 });

  planes = [];
  for (let i = 0; i < 50; i++) {
    planes.push({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      seed: Math.random() * 100,
      parallaxX: 0,
      parallaxY: 0
    });
  }

  hands = new window.Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(results => {
    handLandmarks = results.multiHandLandmarks || [];

    if (handLandmarks.length > 0) {
      const h1 = handLandmarks[0];
      const fingerCount = countFingers(h1);
      if (fingerCount === 5) targetDepth = 0.6;
      else if (fingerCount === 0) targetDepth = 3.0;
      else targetDepth = 1.2;
    }

    if (handLandmarks.length > 1) {
      const h2 = handLandmarks[1];
      const fingerCount2 = countFingers(h2);
      flip = (fingerCount2 === 0) ? -1 : 1;
    } else {
      flip = 1;
    }
  });

  const camera = new window.Camera(video, {
    onFrame: async () => { await hands.send({ image: video }); },
    width: 640,
    height: 480
  });
  camera.start();

  return ({ context, time }) => {
    if (!video || !video.videoWidth) return;
    depth += (targetDepth - depth) * params.smoothness;
    context.filter = `grayscale(100%) contrast(${params.contrast}%) blur(${params.blurAmount}px)`;
    context.drawImage(video, 0, 0, width, height);
    context.filter = "none";
   
    const sortedPlanes = planes.slice().sort((a, b) => (b.z * depth) - (a.z * depth));

    for (let i = 0; i < params.planeCount; i++) {
      const plane = sortedPlanes[i];

      const parallaxX = (plane.x - 0.5) * width * 0.5 * (1 - 1/depth);
      const parallaxY = (plane.y - 0.5) * height * 0.5 * (1 - 1/depth);

      plane.parallaxX += (parallaxX - plane.parallaxX) * params.smoothness;
      plane.parallaxY += (parallaxY - plane.parallaxY) * params.smoothness;

     
      const depthOffset = (plane.z - 0.5) * (depth - 1) * params.disappearStrength;
      const px = plane.x * width + plane.parallaxX + depthOffset;
      const py = plane.y * height + plane.parallaxY + depthOffset;

      const size = params.baseSize * depth * (1 + (1 - plane.z) * 0.5);

      const cropSize = video.videoWidth / 6;
      const sx = (plane.x * video.videoWidth) - cropSize / 2;
      const sy = (plane.y * video.videoHeight) - cropSize / 2;

      context.save();
      context.translate(px, py);
      context.scale(flip, 1);

      context.filter = `grayscale(100%) contrast(${params.contrast}%)`;
      context.drawImage(video, sx, sy, cropSize, cropSize, -size/2, -size/2, size, size);
      context.filter = "none";

      context.fillStyle = "#ffffff";
      context.font = `${size/3}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(i + 1, 0, 0);

      context.strokeStyle = "#ffffff";
      context.lineWidth = 2;
      context.strokeRect(-size/2, -size/2, size, size);

      context.restore();
    }
  };
};


const setupWebcam = async () => {
  video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
  video.srcObject = stream;
  return new Promise(resolve => { video.onloadedmetadata = () => resolve(video); });
};


const start = async () => {
  await loadMediaPipe();
  await setupWebcam();
  await canvasSketch(sketch, settings);
};

start();