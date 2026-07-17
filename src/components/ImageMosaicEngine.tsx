import React, { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { CanvasObject } from '../store/useAppStore';
import { Image as ImageIcon, LayoutGrid, Layers, Loader2 } from 'lucide-react';

interface ImageMosaicEngineProps {
  canvasWidth: number;
  canvasHeight: number;
  selectedShapeId: string | null;
}

export const ImageMosaicEngine: React.FC<ImageMosaicEngineProps> = ({ canvasWidth, canvasHeight, selectedShapeId }) => {
  const library = useAppStore(state => state.library);
  const setCanvasObjects = useAppStore(state => state.setCanvasObjects);
  const canvasObjects = useAppStore(state => state.canvasObjects);
  const saveHistoryState = useAppStore(state => state.saveHistoryState);

  const [density, setDensity] = useState(20); // Step size in pixels. Lower = more shapes.
  const [baseScale, setBaseScale] = useState(1);
  const [style, setStyle] = useState<'grid' | 'overlap'>('grid');
  
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateLuminance = (r: number, g: number, b: number) => {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  const processImage = (imgSrc: string) => {
    if (!selectedShapeId) {
      alert("Please select a shape from your library first!");
      return;
    }
    const shapeDef = library.find(s => s.id === selectedShapeId);
    if (!shapeDef) return;

    setIsProcessing(true);
    saveHistoryState();

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // Calculate scaling to fit within canvas while maintaining aspect ratio
      const maxDim = Math.min(canvasWidth, canvasHeight) * 0.8;
      let scale = 1;
      if (img.width > maxDim || img.height > maxDim) {
        scale = maxDim / Math.max(img.width, img.height);
      }
      
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = drawWidth;
      offscreenCanvas.height = drawHeight;
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight);
      const data = imageData.data;

      const newObjects: CanvasObject[] = [];
      const offsetX = (canvasWidth - drawWidth) / 2;
      const offsetY = (canvasHeight - drawHeight) / 2;

      // Extract pixels based on density (step size)
      const step = Math.max(5, 50 - density); // density slider 0-40 -> step 50-10

      // To avoid freezing the UI, we can chunk the processing, but for ~1000-5000 shapes, 
      // a synchronous loop might take 100ms which is acceptable. Let's do it sync for simplicity.
      
      for (let y = 0; y < drawHeight; y += step) {
        for (let x = 0; x < drawWidth; x += step) {
          const index = (y * drawWidth + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];

          if (a > 20) { // Ignore highly transparent pixels
            const luminance = calculateLuminance(r, g, b);
            const normalizedLuma = luminance / 255; // 0 (dark) to 1 (bright)
            
            // Inversion: Darker pixels make larger shapes (like ink halftone)
            const luminanceScale = 1 - (normalizedLuma * 0.8); // 0.2 to 1.0

            const colorHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

            let finalX = x + offsetX;
            let finalY = y + offsetY;
            let rotation = 0;

            if (style === 'overlap') {
              finalX += (Math.random() - 0.5) * step * 1.5;
              finalY += (Math.random() - 0.5) * step * 1.5;
              rotation = Math.random() * 360;
            }

            const scaleMultiplier = style === 'grid' ? 0.05 : 0.08;
            const finalScale = (step * scaleMultiplier) * baseScale * luminanceScale;

            newObjects.push({
              id: crypto.randomUUID(),
              shapeId: shapeDef.id,
              x: finalX,
              y: finalY,
              scaleX: finalScale,
              scaleY: finalScale,
              rotation: rotation,
              overrideEffect: {
                ...shapeDef.effect,
                colors: [colorHex, colorHex], // Solid mapped color
                type: shapeDef.effect.type === 'glass' ? 'noise' : shapeDef.effect.type // Prevent heavy glass overlap
              }
            });
          }
        }
      }

      // Bulk update state
      setCanvasObjects([...canvasObjects, ...newObjects]);
      setIsProcessing(false);
    };
    img.src = imgSrc;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        processImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mt-6">
      <h4 className="font-bold text-sm text-neutral-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ImageIcon size={16} className="text-blue-400" /> Photo Pointillism
      </h4>

      <div className="space-y-4 mb-4">
        <div>
          <div className="flex justify-between text-xs text-neutral-400 mb-1">
            <span>Density (Resolution)</span>
          </div>
          <input
            type="range"
            min="0" max="40" step="5"
            value={density}
            onChange={(e) => setDensity(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs text-neutral-400 mb-1">
            <span>Base Shape Scale</span>
            <span>{baseScale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5" max="3" step="0.1"
            value={baseScale}
            onChange={(e) => setBaseScale(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div>
          <label className="text-xs text-neutral-400 mb-2 block">Placement Style</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStyle('grid')}
              className={`py-2 rounded border text-xs flex items-center justify-center gap-1 transition-colors ${style === 'grid' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              onClick={() => setStyle('overlap')}
              className={`py-2 rounded border text-xs flex items-center justify-center gap-1 transition-colors ${style === 'overlap' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}
            >
              <Layers size={14} /> Overlap
            </button>
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing || !selectedShapeId}
        className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {isProcessing ? (
          <><Loader2 size={16} className="animate-spin" /> Processing Image...</>
        ) : !selectedShapeId ? (
          "Select a Library Shape First"
        ) : (
          <><ImageIcon size={16} fill="currentColor" /> Upload Image & Generate</>
        )}
      </button>
    </div>
  );
};
