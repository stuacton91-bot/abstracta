import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer, Image as KonvaImage, Rect } from 'react-konva';
import Konva from 'konva';
import { useAppStore } from '../store/useAppStore';
import type { CustomShape, CanvasObject } from '../store/useAppStore';
import { Trash2, Download, ArrowUp, ArrowDown, Copy, FlipHorizontal, FlipVertical, RotateCcw, Upload, Save, Activity, Mic, MicOff, Undo2, Redo2 } from 'lucide-react';
import { audioAnalyzer } from '../lib/audioAnalyzer';
import { createSVGDataUrl } from '../utils/svgGenerator';
import useImage from 'use-image';
import { EffectPanel } from '../components/EffectPanel';
import { AlgorithmicBrushes } from '../components/AlgorithmicBrushes';
import { ColorPicker } from '../components/ColorPicker';

// --- Shape Thumbnail (Sidebar) ---
const ShapeThumbnail: React.FC<{ shape: CustomShape }> = ({ shape }) => {
  const dataUrl = useMemo(() => createSVGDataUrl(shape), [shape]);
  return <img src={dataUrl} alt="Shape Preview" className="w-full h-full object-contain drop-shadow-md pointer-events-none" />;
};

// --- Konva Shape Object ---
interface KonvaShapeProps {
  canvasObj: CanvasObject;
  shape: CustomShape;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: Partial<CanvasObject>) => void;
}

const KonvaShapeComponent: React.FC<KonvaShapeProps> = ({ canvasObj, shape, onSelect, onChange }) => {
  const shapeRef = useRef<Konva.Image>(null);
  
  const effectiveShape = useMemo(() => ({
    ...shape,
    effect: canvasObj.overrideEffect || shape.effect
  }), [shape, canvasObj.overrideEffect]);

  const dataUrl = useMemo(() => createSVGDataUrl(effectiveShape), [effectiveShape]);
  const [image] = useImage(dataUrl);

  // When SVG is converted to an image, the bounding box of the points is shifted by the generator's padding.
  // We need to offset the rendering so the shape appears exactly where the pointer drops it.
  // The generator adds maxDim * 0.5 padding on all sides.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shape.points.forEach(p => {
    if (p.x === -999999 || p.y === -999999) return;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  
  const width = maxX - minX;
  const height = maxY - minY;
  const maxDim = Math.max(width, height) || 1;
  const padding = maxDim * 0.5;

  useEffect(() => {
    if (!shapeRef.current || !canvasObj.behavior || canvasObj.behavior === 'none') return;

    const node = shapeRef.current;
    
    // Use a seeded time offset based on ID so they don't all sync perfectly
    let seed = 0;
    for(let i=0; i<canvasObj.id.length; i++) seed += canvasObj.id.charCodeAt(i);
    
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      const t = frame.time / 1000; // seconds
      
      let currentY = canvasObj.y;
      let currentX = canvasObj.x;
      let currentScaleX = canvasObj.scaleX;
      let currentScaleY = canvasObj.scaleY;
      let currentRot = canvasObj.rotation;

      // Base kinematics
      switch (canvasObj.behavior) {
        case 'float':
          currentY += Math.sin(t * 2 + seed) * 30;
          break;
        case 'pulse':
          const s = 1 + Math.sin(t * 3 + seed) * 0.15;
          currentScaleX *= s;
          currentScaleY *= s;
          break;
        case 'spin':
          currentRot += (t * 45); 
          break;
        case 'orbit':
          currentX += Math.cos(t + seed) * 100;
          currentY += Math.sin(t + seed) * 100;
          break;
      }

      // Audio Reactivity Override
      if (canvasObj.audioReactive && audioAnalyzer.getIsInitialized()) {
        const audio = audioAnalyzer.getAudioData();
        // Bass pumps the scale
        const bassBoost = 1 + (audio.bass * 1.5);
        currentScaleX *= bassBoost;
        currentScaleY *= bassBoost;
        // Treble wiggles the rotation
        currentRot += (audio.treble * 45);
      }

      node.y(currentY);
      node.x(currentX);
      node.scaleX(currentScaleX);
      node.scaleY(currentScaleY);
      node.rotation(currentRot);
    }, node.getLayer());

    anim.start();
    
    return () => {
      anim.stop();
      // Restore base values immediately when animation stops or changes
      node.y(canvasObj.y);
      node.x(canvasObj.x);
      node.scaleX(canvasObj.scaleX);
      node.scaleY(canvasObj.scaleY);
      node.rotation(canvasObj.rotation);
    };
  }, [canvasObj.behavior, canvasObj.x, canvasObj.y, canvasObj.scaleX, canvasObj.scaleY, canvasObj.rotation, canvasObj.id]);

  return (
    <KonvaImage
      id={`shape-${canvasObj.id}`}
      ref={shapeRef}
      image={image}
      x={canvasObj.x}
      y={canvasObj.y}
      offsetX={width/2 + padding}
      offsetY={height/2 + padding}
      scaleX={canvasObj.scaleX}
      scaleY={canvasObj.scaleY}
      rotation={canvasObj.rotation}
      draggable
      hitFunc={(context, shapeObj) => {
        context.beginPath();
        let isFirst = true;
        shape.points.forEach((p) => {
          if (p.x === -999999 || p.y === -999999) {
            context.closePath();
            isFirst = true;
          } else {
            const localX = p.x - minX + padding;
            const localY = p.y - minY + padding;
            if (isFirst) {
              context.moveTo(localX, localY);
              isFirst = false;
            } else {
              context.lineTo(localX, localY);
            }
          }
        });
        if (!isFirst) context.closePath();
        context.fillStrokeShape(shapeObj);
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({ x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (node) {
          onChange({
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          });
        }
      }}
    />
  );
};

// --- Film Grain Overlay ---
const FilmGrainOverlay: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const noiseSvgUrl = useMemo(() => {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.15 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)"/>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  }, [width, height]);

  const [image] = useImage(noiseSvgUrl);
  return <KonvaImage image={image} width={width} height={height} listening={false} globalCompositeOperation="soft-light" />;
};

// --- Main Studio ---
const CanvasStudio: React.FC = () => {
  const library = useAppStore(state => state.library);
  const removeShapeFromLibrary = useAppStore(state => state.removeShapeFromLibrary);
  
  const canvasObjects = useAppStore(state => state.canvasObjects);
  const addCanvasObject = useAppStore(state => state.addCanvasObject);
  const updateCanvasObject = useAppStore(state => state.updateCanvasObject);
  const removeCanvasObject = useAppStore(state => state.removeCanvasObject);
  const setCanvasObjects = useAppStore(state => state.setCanvasObjects);
  
  const canvasColor = useAppStore(state => state.canvasColor);
  const setCanvasColor = useAppStore(state => state.setCanvasColor);
  
  const saveHistoryState = useAppStore(state => state.saveHistoryState);
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);
  const history = useAppStore(state => state.history);
  const future = useAppStore(state => state.future);

  const handleAddObj = (obj: CanvasObject) => { saveHistoryState(); addCanvasObject(obj); };
  const handleUpdateObj = (id: string, updates: Partial<CanvasObject>) => { saveHistoryState(); updateCanvasObject(id, updates); };
  const handleRemoveObj = (id: string) => { saveHistoryState(); removeCanvasObject(id); };
  const handleSetAllObjs = (objs: CanvasObject[]) => { saveHistoryState(); setCanvasObjects(objs); };

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedShapeId, setDraggedShapeId] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);

  const handleEnableMic = async () => {
    await audioAnalyzer.initialize();
    setMicEnabled(true);
  };

  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);



  // Safer transformer attachment
  const layerRef = useRef<Konva.Layer>(null);
  useEffect(() => {
    if (selectedId && trRef.current && layerRef.current) {
      const selectedNode = layerRef.current.findOne(`#shape-${selectedId}`);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer()?.batchDraw();
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, canvasObjects]);


  const checkDeselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.attrs.id === 'bg-rect';
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    stageRef.current?.setPointersPositions(e);
    const pointerPos = stageRef.current?.getPointerPosition();
    
    if (draggedShapeId && pointerPos) {
      const newObj: CanvasObject = {
        id: crypto.randomUUID(),
        shapeId: draggedShapeId,
        x: pointerPos.x,
        y: pointerPos.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };
      handleAddObj(newObj);
      setSelectedId(newObj.id);
    }
    setDraggedShapeId(null);
  };

  const exportImage = () => {
    if (!stageRef.current) return;
    const prevSelected = selectedId;
    setSelectedId(null);
    
    setTimeout(() => {
      const uri = stageRef.current!.toDataURL({ pixelRatio: 3, mimeType: 'image/png' });
      const link = document.createElement('a');
      link.download = `abstracta-composition-${Date.now()}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (prevSelected) setSelectedId(prevSelected);
    }, 100);
  };

  const handleLayerMove = (direction: 'up' | 'down') => {
    if (!selectedId) return;
    const index = canvasObjects.findIndex(o => o.id === selectedId);
    if (index === -1) return;
    
    const newObjects = [...canvasObjects];
    if (direction === 'up' && index < newObjects.length - 1) {
      [newObjects[index], newObjects[index + 1]] = [newObjects[index + 1], newObjects[index]];
      handleSetAllObjs(newObjects);
    } else if (direction === 'down' && index > 0) {
      [newObjects[index], newObjects[index - 1]] = [newObjects[index - 1], newObjects[index]];
      handleSetAllObjs(newObjects);
    }
  };

  const handleDuplicate = () => {
    if (!selectedId) return;
    const objToCopy = canvasObjects.find(o => o.id === selectedId);
    if (objToCopy) {
      const newObj = { ...objToCopy, id: crypto.randomUUID(), x: objToCopy.x + 40, y: objToCopy.y + 40 };
      handleAddObj(newObj);
      setSelectedId(newObj.id);
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    handleRemoveObj(selectedId);
    setSelectedId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field (e.g. prompt)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDelete();
        return;
      }

      if (selectedId) {
        const obj = canvasObjects.find(o => o.id === selectedId);
        if (obj) {
          const moveSpeed = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowUp') handleUpdateObj(selectedId, { y: obj.y - moveSpeed });
          if (e.key === 'ArrowDown') handleUpdateObj(selectedId, { y: obj.y + moveSpeed });
          if (e.key === 'ArrowLeft') handleUpdateObj(selectedId, { x: obj.x - moveSpeed });
          if (e.key === 'ArrowRight') handleUpdateObj(selectedId, { x: obj.x + moveSpeed });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, canvasObjects, handleUpdateObj, handleDelete]);

  const selectedObj = canvasObjects.find(o => o.id === selectedId);
  const selectedShapeDef = selectedObj ? library.find(s => s.id === selectedObj.shapeId) : null;

  const handleExportProject = () => {
    const data = JSON.stringify({
      abstracta: true,
      version: 1,
      library,
      canvasObjects
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `abstracta-project-${Date.now()}.abstr`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.abstracta) {
          if (window.confirm("This will overwrite the current room's canvas and library. Are you sure?")) {
            useAppStore.getState().setLibrary(data.library || []);
            setCanvasObjects(data.canvasObjects || []);
          }
        } else {
          alert("Invalid project file.");
        }
      } catch (err) {
        alert("Failed to parse project file.");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full w-full bg-neutral-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col z-10 shrink-0">
        <div className="p-4 border-b border-neutral-800">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold">Shape Library</h3>
            <div className="flex gap-1">
              <button onClick={handleExportProject} className="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-800 text-neutral-400 hover:text-white transition-colors" title="Save Project to Disk">
                <Save size={14} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded border border-neutral-800 text-neutral-400 hover:text-white transition-colors" title="Load Project from Disk">
                <Upload size={14} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImportProject} accept=".abstr,.json" className="hidden" />
            </div>
          </div>
          <p className="text-xs text-neutral-500">Drag shapes onto the canvas.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {library.length === 0 ? (
            <div className="text-center text-sm text-neutral-500 mt-10">
              <p>Your library is empty.</p>
              <p className="mt-2">Go to the Shape Forge to create shapes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {library.map((shape) => (
                <div 
                  key={shape.id} 
                  draggable
                  onDragStart={() => setDraggedShapeId(shape.id)}
                  className="aspect-square bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVQ4jWNgYGAQIYAJwoz/4QUxKsCogEEDAwMA0xUB+6z+hZAAAAAASUVORK5CYII=')] rounded-lg border border-neutral-800 flex items-center justify-center p-2 cursor-grab active:cursor-grabbing hover:border-neutral-600 transition-colors relative group"
                >
                  <ShapeThumbnail shape={shape} />
                  
                  <button 
                    onClick={() => removeShapeFromLibrary(shape.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    title="Delete from library"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <AlgorithmicBrushes 
            canvasWidth={stageSize.width} 
            canvasHeight={stageSize.height} 
            selectedShapeId={selectedObj?.shapeId || null} 
          />
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative bg-black overflow-hidden flex flex-col">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-800/90 backdrop-blur-md px-4 py-2 rounded-full border border-neutral-700 shadow-xl flex items-center gap-2 z-20">
          <button onClick={undo} disabled={history.length === 0} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Undo"><Undo2 size={18} /></button>
          <button onClick={redo} disabled={future.length === 0} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Redo"><Redo2 size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          
          <button onClick={() => {
            if(window.confirm('Clear all shapes from the canvas?')) {
              handleSetAllObjs([]);
              setSelectedId(null);
            }
          }} className="p-2 text-red-500 hover:text-red-400" title="Clear Entire Canvas"><RotateCcw size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          
          {/* Audio Reactivity Toggle */}
          <button 
            onClick={handleEnableMic} 
            className={`p-2 transition-colors ${micEnabled ? 'text-pink-400' : 'text-neutral-400 hover:text-white'}`} 
            title={micEnabled ? "Microphone Enabled" : "Enable Microphone for Audio Reactivity"}
          >
            {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          <button onClick={() => handleLayerMove('down')} disabled={!selectedId} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Send Backward"><ArrowDown size={18} /></button>
          <button onClick={() => handleLayerMove('up')} disabled={!selectedId} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Bring Forward"><ArrowUp size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          <button onClick={handleDuplicate} disabled={!selectedId} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Duplicate"><Copy size={18} /></button>
          <button onClick={handleDelete} disabled={!selectedId} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30" title="Delete Selected"><Trash2 size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          <button onClick={exportImage} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium ml-2"><Download size={16} /> Export HD</button>
        </div>

        <div className="flex-1" ref={containerRef} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          {stageSize.width > 0 && (
            <Stage width={stageSize.width} height={stageSize.height} onMouseDown={checkDeselect} onTouchStart={checkDeselect} ref={stageRef}>
              <Layer ref={layerRef}>
                {/* Background Rect to catch clicks */}
                <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} id="bg-rect" fill={canvasColor || '#0f0f13'} />
                
                {canvasObjects.map((obj) => {
                  const shapeDef = library.find(s => s.id === obj.shapeId);
                  if (!shapeDef) return null;
                  
                  return (
                    <KonvaShapeComponent
                      key={obj.id}
                      canvasObj={obj}
                      shape={shapeDef}
                      isSelected={obj.id === selectedId}
                      onSelect={() => setSelectedId(obj.id)}
                      onChange={(newAttrs) => handleUpdateObj(obj.id, newAttrs)}
                    />
                  );
                })}
                
                {/* We need an ID on the rendered shape nodes for the transformer to find them */}
                {/* I forgot to pass id to KonvaImage inside KonvaShapeComponent. Let's fix that. */}
                {selectedId && (
                  <Transformer 
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return oldBox;
                      return newBox;
                    }}
                    borderStroke="#3b82f6"
                    anchorStroke="#3b82f6"
                    anchorFill="#fff"
                  />
                )}

                {/* Global Film Grain */}
                <FilmGrainOverlay width={stageSize.width} height={stageSize.height} />
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Properties Sidebar (Live Editing) */}
      {selectedId && selectedObj && selectedShapeDef ? (
        <div className="w-80 bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col z-20 shrink-0 max-h-full">
          <h3 className="font-bold text-lg mb-6 shrink-0">Properties</h3>
          
          <div className="mb-6 shrink-0">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Orientation</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleUpdateObj(selectedId, { scaleX: selectedObj.scaleX * -1 })}
                className="py-2 bg-neutral-900 border border-neutral-800 rounded-md hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <FlipHorizontal size={16} /> Flip X
              </button>
              <button 
                onClick={() => handleUpdateObj(selectedId, { scaleY: selectedObj.scaleY * -1 })}
                className="py-2 bg-neutral-900 border border-neutral-800 rounded-md hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <FlipVertical size={16} /> Flip Y
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6 shrink-0">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={14} /> Behavior (Physics)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['none', 'float', 'pulse', 'spin', 'orbit'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => handleUpdateObj(selectedId, { behavior: b })}
                  className={`py-2 border rounded-md text-sm capitalize transition-colors ${
                    (selectedObj.behavior || 'none') === b 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6 shrink-0 flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Mic size={14} /> React to Sound
            </label>
            <button
              onClick={() => handleUpdateObj(selectedId, { audioReactive: !selectedObj.audioReactive })}
              className={`w-12 h-6 rounded-full transition-colors relative ${selectedObj.audioReactive ? 'bg-pink-500' : 'bg-neutral-800'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${selectedObj.audioReactive ? 'translate-x-7' : 'translate-x-1'}`}></div>
            </button>
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <EffectPanel 
            effect={selectedObj.overrideEffect || selectedShapeDef.effect} 
            onChange={(newEffect) => handleUpdateObj(selectedId, { overrideEffect: newEffect })} 
            className="flex-1"
          />
        </div>
      ) : (
        <div className="w-80 bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col z-20 shrink-0 max-h-full">
          <h3 className="font-bold text-lg mb-6 shrink-0">Canvas Settings</h3>
          <div className="mb-6 shrink-0">
            <ColorPicker 
              label="Background Color"
              color={canvasColor || '#0f0f13'} 
              onChange={setCanvasColor} 
            />
          </div>
          <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm text-center">
            Select a shape on the canvas to view and edit its properties.
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasStudio;
