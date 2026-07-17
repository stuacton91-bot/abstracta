import React, { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Point, ShapeEffect } from '../store/useAppStore';
import { RefreshCw, CheckCircle2, Hexagon, Star, Sparkles, Droplets, Wand2, Pencil, Move, Settings, Cloud, Infinity as InfinityIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getShapeSvgAttributes, generatePathString } from '../utils/svgGenerator';
import { palettes } from '../store/palettes';
import { EffectPanel } from '../components/EffectPanel';
import { GoogleGenAI } from '@google/genai';

const ShapeForge: React.FC = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [symmetry, setSymmetry] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  const [tool, setTool] = useState<'draw' | 'transform'>('draw');
  const [lastPos, setLastPos] = useState<Point | null>(null);

  const [effect, setEffect] = useState<ShapeEffect>({
    type: 'aberration',
    colors: palettes[0].meshStops,
    opacity: 0.8,
    intensity: 1.5,
  });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const addShape = useAppStore(state => state.addShapeToLibrary);
  const addSavedSwatch = useAppStore(state => state.addSavedSwatch);
  const navigate = useNavigate();

  const getCoordinates = (e: React.PointerEvent<SVGSVGElement>): Point | null => {
    if (!svgRef.current) return null;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return null;
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    const coords = getCoordinates(e);
    if (coords) {
      if (tool === 'draw') {
        setPoints([coords]);
        setIsDrawing(true);
      } else {
        setLastPos(coords);
        setIsDrawing(false);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    if (tool === 'draw' && isDrawing) {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last) {
          const dx = coords.x - last.x;
          const dy = coords.y - last.y;
          if (Math.sqrt(dx * dx + dy * dy) < 5) return prev;
        }
        return [...prev, coords];
      });
    } else if (tool === 'transform' && lastPos && e.buttons > 0) {
      const dx = coords.x - lastPos.x;
      const dy = coords.y - lastPos.y;
      setPoints(prev => prev.map(p => p.x === -999999 ? p : { x: p.x + dx, y: p.y + dy }));
      setLastPos(coords);
    }
  };

  const handlePointerUp = () => {
    if (tool === 'draw' && isDrawing) {
      setIsDrawing(false);
      if (symmetry > 1 && points.length > 2) {
        const newPts: Point[] = [];
        for (let s = 0; s < symmetry; s++) {
          const angle = (s * 2 * Math.PI) / symmetry;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          points.forEach(p => {
            if (p.x === -999999) return;
            const tx = p.x - cx;
            const ty = p.y - cy;
            const rx = tx * cos - ty * sin;
            const ry = tx * sin + ty * cos;
            newPts.push({ x: rx + cx, y: ry + cy });
          });
          newPts.push({ x: -999999, y: -999999 });
        }
        setPoints(newPts);
      }
    } else if (tool === 'transform') {
      setLastPos(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    e.preventDefault();
    
    // Find center of points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x === -999999 || p.y === -999999) return;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const cxObj = (minX + maxX) / 2;
    const cyObj = (minY + maxY) / 2;

    const scaleBy = 1.05;
    const scale = e.deltaY > 0 ? 1 / scaleBy : scaleBy;

    setPoints(prev => prev.map(p => {
      if (p.x === -999999 || p.y === -999999) return p;
      return {
        x: cxObj + (p.x - cxObj) * scale,
        y: cyObj + (p.y - cyObj) * scale
      };
    }));
  };

  const clearCanvas = () => {
    setPoints([]);
    setIsDrawing(false);
  };

  const handleSave = () => {
    if (points.length < 3 || isDrawing) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x === -999999 || p.y === -999999) return;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    
    const cxObj = (minX + maxX) / 2;
    const cyObj = (minY + maxY) / 2;
    
    const centeredPoints = points.map(p => ({
      x: p.x === -999999 ? -999999 : p.x - cxObj,
      y: p.y === -999999 ? -999999 : p.y - cyObj
    }));

    addShape({
      id: crypto.randomUUID(),
      points: centeredPoints,
      effect: { ...effect }
    });
    
    navigate('/studio');
  };

  // --- Procedural Generators ---
  const cx = 200; // rough center of the preview window
  const cy = 200;
  
  const handleGeneratePolygon = (sides: number) => {
    const pts: Point[] = [];
    const radius = 100;
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateStar = (pointsCount: number) => {
    const pts: Point[] = [];
    const outer = 120;
    const inner = 50;
    for (let i = 0; i < pointsCount * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (i * Math.PI) / pointsCount - Math.PI / 2;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateBlob = () => {
    const pts: Point[] = [];
    const segments = 48; // Smoothness
    const baseRadius = 90;
    const seedA = Math.random() * 100;
    const seedB = Math.random() * 100;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      const noise = Math.sin(angle * 3 + seedA) * 20 + Math.cos(angle * 5 - seedB) * 15;
      const radius = baseRadius + noise;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateWaveRing = () => {
    const pts: Point[] = [];
    const segments = 100;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      const radius = 90 + Math.sin(angle * 12) * 20; // 12 spikes
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateSpiral = () => {
    const pts: Point[] = [];
    const segments = 150;
    const turns = 3;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * turns * 2 * Math.PI;
      const radius = 10 + (i / segments) * 100;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    const backPts: Point[] = [];
    for (let i = segments - 1; i >= 0; i--) {
      const angle = (i / segments) * turns * 2 * Math.PI;
      const radius = 10 + (i / segments) * 100 - 15; // 15px thickness
      if(radius > 0) {
        backPts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
      }
    }
    setPoints([...pts, ...backPts]);
    setIsDrawing(false);
  };

  const handleGenerateInfinity = () => {
    const pts: Point[] = [];
    const segments = 100;
    const a = 120;
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * 2 * Math.PI;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const x = (a * Math.sqrt(2) * Math.cos(t)) / denom;
      const y = (a * Math.sqrt(2) * Math.cos(t) * Math.sin(t)) / denom;
      pts.push({ x: cx + x, y: cy + y });
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateGear = (teeth: number) => {
    const pts: Point[] = [];
    const segments = teeth * 4;
    const outerRadius = 110;
    const innerRadius = 80;
    for(let i=0; i<segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const phase = i % 4;
      const radius = (phase === 0 || phase === 1) ? outerRadius : innerRadius;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    setPoints(pts);
    setIsDrawing(false);
  };
  
  const handleGenerateCloud = () => {
    const pts: Point[] = [];
    const numBumps = 6;
    const segmentsPerBump = 20;
    const baseRadius = 80;
    for(let b=0; b<numBumps; b++) {
      const baseAngle = (b / numBumps) * 2 * Math.PI;
      const bumpSize = 30 + Math.random() * 20;
      for(let s=0; s<segmentsPerBump; s++) {
        const t = s / segmentsPerBump;
        const bumpAngle = baseAngle + t * (2 * Math.PI / numBumps);
        const bumpRadius = baseRadius + Math.sin(t * Math.PI) * bumpSize;
        pts.push({ x: cx + Math.cos(bumpAngle) * bumpRadius, y: cy + Math.sin(bumpAngle) * bumpRadius });
      }
    }
    setPoints(pts);
    setIsDrawing(false);
  };

  const handleGenerateAIPalette = async () => {
    if (!prompt.trim() || isGeneratingAI) return;
    
    setIsGeneratingAI(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("Gemini API key is missing. Please add VITE_GEMINI_API_KEY to your .env file.");
        setIsGeneratingAI(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are a world-class color theorist and designer. The user will give you a mood or prompt. You must reply with exactly three highly aesthetic, mathematically harmonious HEX color codes (e.g. #ff0055) that perfectly match their prompt. Return ONLY a valid JSON array of 3 strings. Example: ["#FF0055", "#00F0FF", "#39FF14"]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        }
      });

      const text = response.text || "[]";
      let colors: string[] = [];
      try {
        colors = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse Gemini response:", text);
      }

      if (Array.isArray(colors) && colors.length >= 3) {
        setEffect({
          ...effect,
          colors: [colors[0], colors[1], colors[2], colors[0]] // padding to 4 stops for the 2D SVG
        });
        // Save them to the Color System swatches
        colors.forEach(c => addSavedSwatch(c));
      } else {
        alert("The AI returned an invalid format. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("Error generating AI palette. See console for details.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Live SVG attributes
  const svgAttrs = points.length > 2 && !isDrawing 
    ? getShapeSvgAttributes(effect, 'preview')
    : { defs: '', fill: 'transparent', stroke: 'white', filter: '', strokeWidth: '2' };

  return (
    <div className="flex flex-col md:flex-row min-h-full md:h-full w-full bg-neutral-900 text-white overflow-y-auto md:overflow-hidden">
      {/* Main Drawing Area */}
      <div className="w-full shrink-0 md:flex-1 relative flex flex-col items-center justify-center p-4 min-h-[400px] md:min-h-0">
        
        {/* Tool Toggle */}
        <div className="absolute top-4 z-20 flex bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          <button 
            onClick={() => setTool('draw')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${tool === 'draw' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
          >
            <Pencil size={16} /> Draw
          </button>
          <button 
            onClick={() => setTool('transform')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${tool === 'transform' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
          >
            <Move size={16} /> Transform
          </button>
        </div>

        <h2 className="absolute top-20 text-neutral-500 font-medium text-sm text-center">
          {points.length === 0 ? "Draw a closed shape with your finger or mouse" : tool === 'transform' ? "Drag to move • Scroll to resize" : "Shape Forge"}
        </h2>
        
        {/* Drawing Canvas */}
        <div className="w-full max-w-2xl aspect-square bg-neutral-950 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden relative touch-none">
          {/* Background decoration for glassmorphism preview */}
          {effect.type === 'glass' && points.length > 0 && (
             <>
               <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-pink-500 rounded-full mix-blend-screen filter blur-xl opacity-50 animate-pulse"></div>
               <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-blue-500 rounded-full mix-blend-screen filter blur-xl opacity-50"></div>
             </>
          )}

          <svg
            ref={svgRef}
            className={`w-full h-full relative z-10 ${tool === 'draw' ? 'cursor-crosshair' : 'cursor-move'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* Inject complex SVG filters natively! */}
            <defs dangerouslySetInnerHTML={{ __html: svgAttrs.defs }} />

            {points.length > 0 && (
              <path
                d={generatePathString(points, !isDrawing)}
                fill={svgAttrs.fill}
                stroke={svgAttrs.stroke}
                strokeWidth={isDrawing ? "3" : svgAttrs.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={svgAttrs.filter}
                className={`transition-all duration-300 ${effect.type === 'glass' && !isDrawing ? 'backdrop-blur-md' : ''}`}
              />
            )}
          </svg>
        </div>

        {points.length > 0 && (
          <button 
            onClick={clearCanvas}
            className="absolute bottom-6 right-6 bg-neutral-800 hover:bg-neutral-700 text-white p-3 rounded-full shadow-lg transition-colors z-20"
            title="Clear Canvas"
          >
            <RefreshCw size={20} />
          </button>
        )}
      </div>

      {/* Effects Panel */}
      <div className="w-full md:w-80 bg-neutral-950 border-t md:border-t-0 md:border-l border-neutral-800 p-6 flex flex-col shrink-0 md:overflow-y-auto">
        <h3 className="font-bold text-lg mb-4 shrink-0">Generative Tools</h3>
        <div className="grid grid-cols-3 gap-2 mb-6 shrink-0">
          <button onClick={() => handleGeneratePolygon(3)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Hexagon size={14} /> Triangle
          </button>
          <button onClick={() => handleGeneratePolygon(5)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Hexagon size={14} /> Pentagon
          </button>
          <button onClick={() => handleGeneratePolygon(6)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Hexagon size={14} /> Hexagon
          </button>
          
          <button onClick={() => handleGenerateStar(5)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Star size={14} /> 5-Pt Star
          </button>
          <button onClick={() => handleGenerateStar(8)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Star size={14} /> 8-Pt Burst
          </button>
          <button onClick={() => handleGenerateGear(8)} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Settings size={14} /> Gear
          </button>

          <button onClick={handleGenerateBlob} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Droplets size={14} /> Blob
          </button>
          <button onClick={handleGenerateCloud} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Cloud size={14} /> Cloud
          </button>
          <button onClick={handleGenerateWaveRing} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <Sparkles size={14} /> Wave
          </button>

          <button onClick={handleGenerateSpiral} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <RefreshCw size={14} /> Spiral
          </button>
          <button onClick={handleGenerateInfinity} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 rounded-md text-[10px] font-bold flex flex-col items-center gap-1 transition-colors">
            <InfinityIcon size={14} /> Infinity
          </button>
        </div>

        <div className="mb-6 shrink-0">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between mb-2">
            <span>Mandala Symmetry</span>
            <span className="text-blue-400">{symmetry}x</span>
          </label>
          <input 
            type="range" min="1" max="12" step="1" 
            value={symmetry} 
            onChange={(e) => setSymmetry(Number(e.target.value))}
            className="w-full accent-blue-500" 
          />
          <p className="text-[10px] text-neutral-600 mt-1">Set to 2+ and draw a line on the canvas to revolve it.</p>
        </div>

        <div className="mb-6 shrink-0">
          <label className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wand2 size={14} className="text-pink-500" /> AI Palette Architect
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. Cyberpunk Neon" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateAIPalette()}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
            />
            <button 
              onClick={handleGenerateAIPalette}
              disabled={isGeneratingAI}
              className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-3 py-2 rounded-md transition-colors"
            >
              {isGeneratingAI ? '...' : 'Go'}
            </button>
          </div>
        </div>

        <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

        <h3 className="font-bold text-lg mb-4 shrink-0">Effect Engine</h3>
        <EffectPanel effect={effect} onChange={setEffect} />
        <div className="pt-4 mt-auto border-t border-neutral-800 shrink-0">
          <button 
            onClick={handleSave}
            disabled={points.length < 3 || isDrawing}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <CheckCircle2 size={20} />
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShapeForge;
