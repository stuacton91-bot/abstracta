import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { CanvasObject, CustomShape } from '../store/useAppStore';
import { Play, Sparkles } from 'lucide-react';

interface AlgorithmicBrushesProps {
  canvasWidth: number;
  canvasHeight: number;
  selectedShapeId: string | null;
}

// Simple color interpolator (HSL)
const interpolateColor = (i: number, total: number): string => {
  const hue = (i / total) * 360;
  return `hsl(${hue}, 80%, 60%)`;
};

export const AlgorithmicBrushes: React.FC<AlgorithmicBrushesProps> = ({ canvasWidth, canvasHeight, selectedShapeId }) => {
  const library = useAppStore(state => state.library);
  const addCanvasObject = useAppStore(state => state.addCanvasObject);
  const saveHistoryState = useAppStore(state => state.saveHistoryState);

  const [brushType, setBrushType] = useState<'pendulum' | 'walker' | 'supernova' | 'fibonacci' | 'sine' | 'vortex' | 'rings' | 'honeycomb' | 'swarm' | 'lissajous'>('pendulum');
  const [chaosMode, setChaosMode] = useState(false);
  const [rainbowPaint, setRainbowPaint] = useState(false);
  const [dropSize, setDropSize] = useState(1);
  const [isPainting, setIsPainting] = useState(false);

  const generatePendulumPath = (count: number, cx: number, cy: number) => {
    const path = [];
    const A = Math.min(canvasWidth, canvasHeight) * 0.4; // Initial amplitude
    const B = A * 0.8;
    const f1 = 3.0; // Frequency X
    const f2 = 2.0; // Frequency Y
    const d = 0.02; // Damping (decay)
    const phase = Math.PI / 2;

    for (let i = 0; i < count; i++) {
      const t = i * 0.1;
      const decay = Math.exp(-d * t);
      const x = cx + A * decay * Math.sin(t * f1 + phase);
      const y = cy + B * decay * Math.sin(t * f2);
      path.push({ x, y, scale: dropSize * decay, rotation: t * 10 });
    }
    return path;
  };

  const generateWalkerPath = (count: number, cx: number, cy: number) => {
    const path = [];
    let currX = cx;
    let currY = cy;
    let currAngle = Math.random() * Math.PI * 2;
    
    for (let i = 0; i < count; i++) {
      path.push({ x: currX, y: currY, scale: dropSize * (0.5 + Math.random() * 0.5), rotation: currAngle * 57.3 });
      
      currAngle += (Math.random() - 0.5) * 2; // Wander
      const step = 20 + Math.random() * 40;
      currX += Math.cos(currAngle) * step;
      currY += Math.sin(currAngle) * step;
      
      // Bounce off walls
      if (currX < 0) currX = 0;
      if (currX > canvasWidth) currX = canvasWidth;
      if (currY < 0) currY = 0;
      if (currY > canvasHeight) currY = canvasHeight;
    }
    return path;
  };

  const generateSupernovaPath = (count: number, cx: number, cy: number) => {
    const path = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.pow(Math.random(), 0.5) * (Math.min(canvasWidth, canvasHeight) * 0.4);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      path.push({ x, y, scale: dropSize * (0.2 + Math.random() * 0.8), rotation: Math.random() * 360, distance });
    }
    // Sort by distance to animate expanding outwards
    return path.sort((a, b) => a.distance - b.distance);
  };

  const generateFibonacciPath = (count: number, cx: number, cy: number) => {
    const path = [];
    const phi = (1 + Math.sqrt(5)) / 2;
    const goldenAngle = 2 * Math.PI * (1 - 1/phi);
    
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(i) * 20 * (Math.min(canvasWidth, canvasHeight) / 800);
      const theta = i * goldenAngle;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      path.push({ x, y, scale: dropSize * (0.3 + (i / count) * 1.5), rotation: theta * 57.3 });
    }
    return path;
  };

  const generateSinePath = (count: number, cx: number, cy: number) => {
    const path = [];
    const width = canvasWidth * 0.8;
    const startX = cx - width / 2;
    
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = startX + t * width;
      const y = cy + Math.sin(t * Math.PI * 4) * (canvasHeight * 0.2);
      path.push({ x, y, scale: dropSize, rotation: Math.cos(t * Math.PI * 4) * 45 });
    }
    return path;
  };

  const generateVortexPath = (count: number, cx: number, cy: number) => {
    const path = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const r = (1 - t) * (Math.min(canvasWidth, canvasHeight) * 0.4);
      const theta = t * Math.PI * 10;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      path.push({ x, y, scale: dropSize * (0.1 + (1 - t) * 1.5), rotation: theta * 57.3 });
    }
    // Reverse so it draws from outside in
    return path.reverse();
  };

  const generateRingsPath = (count: number, cx: number, cy: number) => {
    const path = [];
    const numRings = 4;
    let pointsAdded = 0;
    
    for (let ring = 1; ring <= numRings; ring++) {
      const radius = ring * (Math.min(canvasWidth, canvasHeight) * 0.1);
      const pointsInRing = Math.floor((count * ring) / (numRings * (numRings + 1) / 2));
      
      for (let i = 0; i < pointsInRing; i++) {
        const theta = (i / pointsInRing) * Math.PI * 2;
        const x = cx + radius * Math.cos(theta);
        const y = cy + radius * Math.sin(theta);
        path.push({ x, y, scale: dropSize * (0.5 + ring * 0.2), rotation: theta * 57.3 });
        pointsAdded++;
      }
    }
    
    // Add any remaining points to the center
    for (let i = pointsAdded; i < count; i++) {
       path.push({ x: cx, y: cy, scale: dropSize * 0.5, rotation: Math.random() * 360 });
    }
    return path;
  };

  const generateHoneycombPath = (count: number, cx: number, cy: number) => {
    const path = [];
    const spacing = 50 * dropSize;
    const cols = Math.floor(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    
    const startX = cx - ((cols - 1) * spacing) / 2;
    const startY = cy - ((rows - 1) * spacing * 0.866) / 2;
    
    let added = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (added >= count) break;
        const xOffset = (row % 2 === 0) ? 0 : spacing * 0.5;
        const x = startX + col * spacing + xOffset;
        const y = startY + row * spacing * 0.866;
        path.push({ x, y, scale: dropSize, rotation: 30 });
        added++;
      }
    }
    return path;
  };

  const generateSwarmPath = (count: number, cx: number, cy: number) => {
    const path = [];
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const theta = 2 * Math.PI * u;
      // Box-Muller transform for gaussian distribution
      const r = Math.sqrt(-2 * Math.log(1 - Math.random())) * (Math.min(canvasWidth, canvasHeight) * 0.1);
      
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      path.push({ x, y, scale: dropSize * (0.2 + Math.random() * 0.8), rotation: Math.random() * 360 });
    }
    return path;
  };

  const generateLissajousPath = (count: number, cx: number, cy: number) => {
    const path = [];
    const A = Math.min(canvasWidth, canvasHeight) * 0.4;
    const B = A;
    const a = 5; // x-lobe frequency
    const b = 4; // y-lobe frequency
    const delta = Math.PI / 2; // Phase shift
    
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const x = cx + A * Math.sin(a * t + delta);
      const y = cy + B * Math.sin(b * t);
      path.push({ x, y, scale: dropSize * 0.8, rotation: t * 360 });
    }
    return path;
  };

  const handleStartPainting = () => {
    if (library.length === 0) return alert("Your library is empty! Go to the Shape Forge first.");
    if (!chaosMode && !selectedShapeId) return alert("Select a shape from the canvas, or enable Chaos Mode to use random shapes.");

    setIsPainting(true);
    saveHistoryState(); // Save history right before starting the macro

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    let path: Array<{x: number, y: number, scale: number, rotation: number}> = [];

    const numPoints = brushType === 'pendulum' ? 100 : brushType === 'walker' ? 60 : 40;

    if (brushType === 'pendulum') path = generatePendulumPath(numPoints, cx, cy);
    else if (brushType === 'walker') path = generateWalkerPath(numPoints, cx, cy);
    else if (brushType === 'supernova') path = generateSupernovaPath(numPoints, cx, cy);
    else if (brushType === 'fibonacci') path = generateFibonacciPath(numPoints, cx, cy);
    else if (brushType === 'sine') path = generateSinePath(numPoints, cx, cy);
    else if (brushType === 'vortex') path = generateVortexPath(numPoints, cx, cy);
    else if (brushType === 'rings') path = generateRingsPath(numPoints, cx, cy);
    else if (brushType === 'honeycomb') path = generateHoneycombPath(numPoints, cx, cy);
    else if (brushType === 'swarm') path = generateSwarmPath(numPoints, cx, cy);
    else if (brushType === 'lissajous') path = generateLissajousPath(numPoints, cx, cy);

    let i = 0;
    const timer = setInterval(() => {
      if (i >= path.length) {
        clearInterval(timer);
        setIsPainting(false);
        return;
      }

      const pt = path[i];
      let shapeToDrop: CustomShape;
      
      if (chaosMode) {
        shapeToDrop = library[Math.floor(Math.random() * library.length)];
      } else {
        shapeToDrop = library.find(s => s.id === selectedShapeId) || library[0];
      }

      const newObj: CanvasObject = {
        id: crypto.randomUUID(),
        shapeId: shapeToDrop.id,
        x: pt.x,
        y: pt.y,
        scaleX: pt.scale,
        scaleY: pt.scale,
        rotation: pt.rotation,
      };

      if (rainbowPaint) {
        newObj.overrideEffect = {
          ...shapeToDrop.effect,
          colors: [interpolateColor(i, path.length), interpolateColor((i + 10) % path.length, path.length)],
        };
      }

      addCanvasObject(newObj);
      i++;
    }, 50); // Drop a shape every 50ms
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mt-6">
      <h4 className="font-bold text-sm text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-purple-400" /> Algorithmic Brushes
      </h4>

      <div className="mb-4">
        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">Algorithm</label>
        <select 
          value={brushType} 
          onChange={(e) => setBrushType(e.target.value as any)}
          className="w-full bg-neutral-950 border border-neutral-800 text-sm text-neutral-300 rounded-md py-2 px-3 outline-none focus:border-purple-500 transition-colors"
        >
          <option value="pendulum">Pendulum Physics</option>
          <option value="walker">Random Walker</option>
          <option value="supernova">Supernova Burst</option>
          <option value="fibonacci">Fibonacci Spiral</option>
          <option value="sine">Sine Wave</option>
          <option value="vortex">Depth Vortex</option>
          <option value="rings">Concentric Rings</option>
          <option value="honeycomb">Hexagonal Honeycomb</option>
          <option value="swarm">Particle Swarm</option>
          <option value="lissajous">Lissajous Curves</option>
        </select>
      </div>

      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between text-xs text-neutral-400 mb-1">
            <span>Drop Size</span>
            <span>{dropSize.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.1" max="3" step="0.1"
            value={dropSize}
            onChange={(e) => setDropSize(parseFloat(e.target.value))}
            className="w-full accent-purple-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-neutral-400">Chaos Mode (Random Shapes)</label>
          <button onClick={() => setChaosMode(!chaosMode)} className={`w-10 h-5 rounded-full transition-colors relative ${chaosMode ? 'bg-purple-500' : 'bg-neutral-800'}`}>
            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${chaosMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-neutral-400">Virtual Paint Tin (Rainbow)</label>
          <button onClick={() => setRainbowPaint(!rainbowPaint)} className={`w-10 h-5 rounded-full transition-colors relative ${rainbowPaint ? 'bg-purple-500' : 'bg-neutral-800'}`}>
            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${rainbowPaint ? 'translate-x-6' : 'translate-x-1'}`}></div>
          </button>
        </div>
      </div>

      <button
        onClick={handleStartPainting}
        disabled={isPainting || library.length === 0}
        className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {isPainting ? (
          <span className="animate-pulse">Painting...</span>
        ) : (
          <><Play size={16} fill="currentColor" /> Throw Paint</>
        )}
      </button>
    </div>
  );
};
