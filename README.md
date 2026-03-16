# MediaPipe Vision Sketches

Experimental **computer vision sketches** built using **MediaPipe**, **canvas-sketch**

This project explores different approaches to **interactive computer vision**, combining **hand tracking**, **pose detection**, and **real-time webcam manipulation** to create generative visual systems.

The sketches simulate various **AI-like visual interfaces** that react to body movement and hand gestures, transforming live camera input into interactive visual experiments.

---

## Preview

Example visuals produced by the system:

- Gesture-controlled depth planes
- Interactive webcam puzzle grid
- X-ray style pose skeleton visualization
- Hand-tracked interaction systems

---

## Features

- Real-time webcam input processing
- **MediaPipe Hands** gesture tracking
- **MediaPipe Pose** skeleton detection
- Interactive puzzle grid manipulation
- Depth plane visual illusion
- Gesture-based visual control
- Real-time visual rendering with HTML5 Canvas
- Parameter control using **Tweakpane**

---

## Project Structure
    mediapipe-vision-sketches
    │
    ├── audio
    │ ├── criswar.mp3
    │ ├── spectrum.webm
    │ └── techno.webm
    │
    ├── Neural-Gesture-Scanner.js
    ├── Neural-Puzzle-Scanner.js
    ├── Neural-X-Ray-Pose-Scanner.js
    │
    ├── package.json
    ├── package-lock.json
    └── README.md

**Description**

- **audio/** → audio sources used for visual and interaction experiments  
- **Neural-Gesture-Scanner.js** → hand gesture controlled depth plane system  
- **Neural-Puzzle-Scanner.js** → interactive webcam puzzle controlled by pinch gestures  
- **Neural-X-Ray-Pose-Scanner.js** → pose skeleton visualization with glowing bones  
- **package.json** → project dependencies and scripts  

---

## Technologies Used

- **JavaScript**
- **MediaPipe**
- **canvas-sketch**
- **Tweakpane**
- **Webcam API**

---

## How It Works

1. Webcam frames are captured in real time.
2. MediaPipe analyzes body or hand landmarks.
3. Detected landmarks are mapped into interactive visual systems.
4. Gestures control movement, depth, or puzzle interactions.
5. Visual elements are rendered in real time using Canvas.

The result is an **interactive artificial vision interface** that responds to body movement and gestures.

---

Install dependencies:

```bash
npm install
```

Run the project:

```bash
npm run dev
```

---

## Running the Sketches

Run a sketch using **canvas-sketch**.

### Neural Gesture Scanner

```bash
npx canvas-sketch Neural-Gesture-Scanner.js --open
```

### Neural Puzzle Scanner

```bash
npx canvas-sketch Neural-Puzzle-Scanner.js --open
```

### Neural X-Ray Pose Scanner

```bash
npx canvas-sketch Neural-X-Ray-Pose-Scanner.js --open
```

Make sure **webcam permission is enabled in your browser**.

---

## Controls

### Keyboard

```
P → Save PNG
R → Start recording
S → Stop recording
```

Some sketches also include **gesture-based controls using MediaPipe Hands**.

Parameters can also be adjusted in real time using the **Tweakpane control panel**.

---

## Inspiration

This project is inspired by:

- interactive computer vision
- gesture-based interfaces
- generative media art
- experimental creative coding
- AI visual systems
- computer vision interfaces
- surveillance camera aesthetics

---

## Possible Applications

- Interactive installations
- Live visual performances
- Digital media art
- Creative coding experiments
- Computer vision prototypes
- Media art performances
- Generative visual research

---

## Author

Creative coding & experimental computer vision project by **vansatt**
