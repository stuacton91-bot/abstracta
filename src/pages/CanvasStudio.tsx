import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Transformer, Image as KonvaImage, Rect } from 'react-konva';
import Konva from 'konva';
import { useAppStore } from '../store/useAppStore';
import type { CustomShape, CanvasObject } from '../store/useAppStore';
import { Trash2, Download, ArrowUp, ArrowDown, Copy, FlipHorizontal, FlipVertical, RotateCcw, Upload, Save, Activity, Mic, MicOff, Undo2, Redo2, Zap } from 'lucide-react';
import { audioAnalyzer } from '../lib/audioAnalyzer';
import { createSVGDataUrl } from '../utils/svgGenerator';
import useImage from 'use-image';
import { EffectPanel } from '../components/EffectPanel';
import { AlgorithmicBrushes } from '../components/AlgorithmicBrushes';
import { ColorPicker } from '../components/ColorPicker';
import BackgroundEngine from '../components/BackgroundEngine';

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
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (newAttrs: Partial<CanvasObject>) => void;
  performanceMode: 'high_quality' | 'performance';
}

const KonvaShapeComponent: React.FC<KonvaShapeProps> = ({ canvasObj, shape, onSelect, onChange, performanceMode }) => {
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

  useEffect(() => {
    if (!shapeRef.current || !image) return;
    if (performanceMode === 'performance') {
      // Allow a tiny delay for image to map to Konva canvas internally before caching
      const t = setTimeout(() => {
        shapeRef.current?.cache({ pixelRatio: window.devicePixelRatio || 2 });
      }, 50);
      return () => clearTimeout(t);
    } else {
      shapeRef.current.clearCache();
    }
  }, [performanceMode, image, effectiveShape]);

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

// --- Main Studio ---
const CanvasStudio: React.FC = () => {
  const library = useAppStore(state => state.library);
  const removeShapeFromLibrary = useAppStore(state => state.removeShapeFromLibrary);
  
  const canvasObjects = useAppStore(state => state.canvasObjects);
  const addCanvasObject = useAppStore(state => state.addCanvasObject);
  const updateCanvasObject = useAppStore(state => state.updateCanvasObject);
  const removeCanvasObject = useAppStore(state => state.removeCanvasObject);
  const setCanvasObjects = useAppStore(state => state.setCanvasObjects);
  
  const canvasEnv = useAppStore(state => state.canvasEnv);
  const setCanvasEnv = useAppStore(state => state.setCanvasEnv);
  
  const saveHistoryState = useAppStore(state => state.saveHistoryState);
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);
  const history = useAppStore(state => state.history);
  const future = useAppStore(state => state.future);

  const performanceMode = useAppStore(state => state.performanceMode);
  const setPerformanceMode = useAppStore(state => state.setPerformanceMode);

  const handleAddObj = (obj: CanvasObject) => { saveHistoryState(); addCanvasObject(obj); };
  const handleUpdateObj = (id: string, updates: Partial<CanvasObject>) => { saveHistoryState(); updateCanvasObject(id, updates); };

  const handleSetAllObjs = (objs: CanvasObject[]) => { saveHistoryState(); setCanvasObjects(objs); };

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState({ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 });
  
  const [draggedShapeId, setDraggedShapeId] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);

  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const [fps, setFps] = useState(60);

  // Auto-detect FPS loop
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let poorFpsCount = 0;
    let reqId: number;

    const loop = (time: number) => {
      frameCount++;
      const delta = time - lastTime;
      if (delta >= 1000) {
        const currentFps = (frameCount * 1000) / delta;
        setFps(Math.round(currentFps));
        
        if (currentFps < 30) {
          poorFpsCount++;
        } else {
          poorFpsCount = 0;
        }

        if (poorFpsCount >= 3 && useAppStore.getState().performanceMode !== 'performance') {
          useAppStore.getState().setPerformanceMode('performance');
          console.warn("Auto-switched to Performance Mode due to low FPS");
          poorFpsCount = 0;
        }

        frameCount = 0;
        lastTime = time;
      }
      reqId = requestAnimationFrame(loop);
    };
    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, []);

  const getRelativePointerPosition = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.id() === 'bg-rect' || e.target.id() === 'background-engine';
    if (clickedOnEmpty) {
      if (!e.evt.shiftKey) {
        setSelectedIds([]);
      }
      const stage = e.target.getStage();
      if (stage) {
        const pos = getRelativePointerPosition(stage);
        setSelectionRect({
          visible: true,
          x1: pos.x,
          y1: pos.y,
          x2: pos.x,
          y2: pos.y,
        });
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectionRect.visible) return;
    const stage = e.target.getStage();
    if (stage) {
      const pos = getRelativePointerPosition(stage);
      setSelectionRect(prev => ({ ...prev, x2: pos.x, y2: pos.y }));
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectionRect.visible) return;
    setSelectionRect(prev => ({ ...prev, visible: false }));
    
    const box = {
      x: Math.min(selectionRect.x1, selectionRect.x2),
      y: Math.min(selectionRect.y1, selectionRect.y2),
      width: Math.abs(selectionRect.x1 - selectionRect.x2),
      height: Math.abs(selectionRect.y1 - selectionRect.y2),
    };
    
    if (box.width < 5 || box.height < 5) return; // Ignore tiny accidental drags

    const newSelectedIds = canvasObjects.filter(obj => {
      const node = layerRef.current?.findOne(`#shape-${obj.id}`);
      if (!node) return false;
      const layer = stageRef.current?.getLayer();
      const stageBox = node.getClientRect({ relativeTo: layer ? layer : undefined });
      // Check intersection
      return !(
        stageBox.x > box.x + box.width ||
        stageBox.x + stageBox.width < box.x ||
        stageBox.y > box.y + box.height ||
        stageBox.y + stageBox.height < box.y
      );
    }).map(obj => obj.id);

    if (e.evt.shiftKey) {
      setSelectedIds(prev => [...new Set([...prev, ...newSelectedIds])]);
    } else {
      setSelectedIds(newSelectedIds);
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // limit scale
    if (newScale > 10 || newScale < 0.1) return;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

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
    if (selectedIds.length > 0 && trRef.current && layerRef.current) {
      const nodes = selectedIds.map(id => layerRef.current?.findOne(`#shape-${id}`)).filter(Boolean) as Konva.Node[];
      trRef.current.nodes(nodes);
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedIds, canvasObjects]);

  // Keyboard navigation for all selected
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const moveAmount = e.shiftKey ? 10 : 1;
        saveHistoryState();
        
        selectedIds.forEach(id => {
          const obj = canvasObjects.find(o => o.id === id);
          if (!obj) return;
          let newX = obj.x;
          let newY = obj.y;
          
          if (e.key === 'ArrowUp') newY -= moveAmount;
          if (e.key === 'ArrowDown') newY += moveAmount;
          if (e.key === 'ArrowLeft') newX -= moveAmount;
          if (e.key === 'ArrowRight') newX += moveAmount;
          
          updateCanvasObject(id, { x: newX, y: newY });
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, canvasObjects, updateCanvasObject, saveHistoryState]);



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
      setSelectedIds([newObj.id]);
    }
    setDraggedShapeId(null);
  };

  const exportImage = () => {
    if (!stageRef.current) return;
    const prevSelected = selectedIds;
    setSelectedIds([]);
    
    setTimeout(() => {
      const uri = stageRef.current!.toDataURL({ pixelRatio: 3, mimeType: 'image/png' });
      const link = document.createElement('a');
      link.download = `abstracta-composition-${Date.now()}.png`;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (prevSelected) setSelectedIds(prevSelected);
    }, 100);
  };

  const handleLayerMove = (dir: 'up' | 'down') => {
    if (selectedIds.length === 0) return;
    // Layer move is tricky with multiple. For now, if single selected:
    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      const idx = canvasObjects.findIndex(o => o.id === id);
      if (idx === -1) return;
      saveHistoryState();
      const newObjs = [...canvasObjects];
      if (dir === 'up' && idx < newObjs.length - 1) {
        const temp = newObjs[idx + 1];
        newObjs[idx + 1] = newObjs[idx];
        newObjs[idx] = temp;
      } else if (dir === 'down' && idx > 0) {
        const temp = newObjs[idx - 1];
        newObjs[idx - 1] = newObjs[idx];
        newObjs[idx] = temp;
      }
      setCanvasObjects(newObjs);
    }
  };

  const handleDuplicate = () => {
    if (selectedIds.length === 0) return;
    saveHistoryState();
    const newIds: string[] = [];
    selectedIds.forEach(id => {
      const objToCopy = canvasObjects.find(o => o.id === id);
      if (objToCopy) {
        const newObj = { ...objToCopy, id: crypto.randomUUID(), x: objToCopy.x + 40, y: objToCopy.y + 40 };
        addCanvasObject(newObj);
        newIds.push(newObj.id);
      }
    });
    setSelectedIds(newIds);
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    saveHistoryState();
    selectedIds.forEach(id => removeCanvasObject(id));
    setSelectedIds([]);
  };

  // Note: Keyboard navigation for Arrow keys is handled in the useEffect at line 352.
  // We'll add Backspace/Delete handling there or here.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, canvasObjects, handleDelete]);

  const selectedObj = selectedIds.length > 0 ? canvasObjects.find(o => o.id === selectedIds[0]) : null;


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
              setSelectedIds([]);
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
          <button onClick={() => handleLayerMove('down')} disabled={selectedIds.length === 0} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Send Backward"><ArrowDown size={18} /></button>
          <button onClick={() => handleLayerMove('up')} disabled={selectedIds.length === 0} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Bring Forward"><ArrowUp size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          <button onClick={handleDuplicate} disabled={selectedIds.length === 0} className="p-2 text-neutral-400 hover:text-white disabled:opacity-30" title="Duplicate"><Copy size={18} /></button>
          <button onClick={handleDelete} disabled={selectedIds.length === 0} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30" title="Delete Selected"><Trash2 size={18} /></button>
          <div className="w-px h-6 bg-neutral-600 mx-1"></div>
          <button onClick={exportImage} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium ml-2"><Download size={16} /> Export HD</button>
        </div>

        <div className="flex-1" ref={containerRef} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          {stageSize.width > 0 && (
            <Stage 
              width={stageSize.width} 
              height={stageSize.height} 
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown} 
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
              onWheel={handleWheel}
              scaleX={stageScale}
              scaleY={stageScale}
              x={stagePos.x}
              y={stagePos.y}
              ref={stageRef}
            >
              <Layer listening={false}>
                <BackgroundEngine width={stageSize.width} height={stageSize.height} env={canvasEnv} performanceMode={performanceMode} />
              </Layer>
              <Layer ref={layerRef}>
                
                {canvasObjects.map((obj) => {
                  const shapeDef = library.find(s => s.id === obj.shapeId);
                  if (!shapeDef) return null;
                  
                  return (
                    <KonvaShapeComponent
                      key={obj.id}
                      canvasObj={obj}
                      shape={shapeDef}
                      isSelected={selectedIds.includes(obj.id)}
                      onSelect={(e) => {
                        if (e.evt.shiftKey) {
                          setSelectedIds(prev => prev.includes(obj.id) ? prev.filter(id => id !== obj.id) : [...prev, obj.id]);
                        } else {
                          setSelectedIds([obj.id]);
                        }
                      }}
                      onChange={(newAttrs) => handleUpdateObj(obj.id, newAttrs)}
                      performanceMode={performanceMode}
                    />
                  );
                })}
                
                {/* We need an ID on the rendered shape nodes for the transformer to find them */}
                {selectedIds.length > 0 && (
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
                {selectionRect.visible && (
                  <Rect
                    x={Math.min(selectionRect.x1, selectionRect.x2)}
                    y={Math.min(selectionRect.y1, selectionRect.y2)}
                    width={Math.abs(selectionRect.x1 - selectionRect.x2)}
                    height={Math.abs(selectionRect.y1 - selectionRect.y2)}
                    fill="rgba(59, 130, 246, 0.2)"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {/* Properties Sidebar (Live Editing) */}
      {selectedIds.length > 0 ? (
        <div className="w-80 bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col z-20 shrink-0 max-h-full">
          <h3 className="font-bold text-lg mb-6 shrink-0">
            {selectedIds.length === 1 ? 'Properties' : `${selectedIds.length} Items Selected`}
          </h3>
          
          <div className="mb-6 shrink-0">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Orientation</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  saveHistoryState();
                  selectedIds.forEach(id => {
                    const obj = canvasObjects.find(o => o.id === id);
                    if (obj) updateCanvasObject(id, { scaleX: obj.scaleX * -1 });
                  });
                }}
                className="py-2 bg-neutral-900 border border-neutral-800 rounded-md hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <FlipHorizontal size={16} /> Flip X
              </button>
              <button 
                onClick={() => {
                  saveHistoryState();
                  selectedIds.forEach(id => {
                    const obj = canvasObjects.find(o => o.id === id);
                    if (obj) updateCanvasObject(id, { scaleY: obj.scaleY * -1 });
                  });
                }}
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
              {(['none', 'float', 'pulse', 'spin', 'orbit'] as const).map((b) => {
                const firstObj = canvasObjects.find(o => o.id === selectedIds[0]);
                const isActive = firstObj?.behavior === b;
                return (
                  <button
                    key={b}
                    onClick={() => {
                      saveHistoryState();
                      selectedIds.forEach(id => updateCanvasObject(id, { behavior: b }));
                    }}
                    className={`py-2 border rounded-md text-sm capitalize transition-colors ${
                      isActive 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6 shrink-0 flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              <Mic size={14} /> React to Sound
            </label>
            {(() => {
              const firstObj = canvasObjects.find(o => o.id === selectedIds[0]);
              const isReactive = firstObj?.audioReactive || false;
              return (
                <button
                  onClick={() => {
                    saveHistoryState();
                    selectedIds.forEach(id => updateCanvasObject(id, { audioReactive: !isReactive }));
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isReactive ? 'bg-pink-500' : 'bg-neutral-800'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isReactive ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              );
            })()}
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <EffectPanel 
            effect={canvasObjects.find(o => o.id === selectedIds[0])?.overrideEffect || library.find(s => s.id === canvasObjects.find(o => o.id === selectedIds[0])?.shapeId)?.effect!} 
            onChange={(newEffect) => {
              saveHistoryState();
              selectedIds.forEach(id => updateCanvasObject(id, { overrideEffect: newEffect }));
            }} 
            className="flex-1"
          />
        </div>
      ) : (
        <div className="w-80 bg-neutral-950 border-l border-neutral-800 p-6 flex flex-col z-20 shrink-0 overflow-y-auto">
          <h3 className="font-bold text-lg mb-6 shrink-0">Environment Settings</h3>
          
          <div className="mb-6">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Fill Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(['solid', 'linear', 'radial', 'holographic'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCanvasEnv({ ...canvasEnv, mode: m })}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium capitalize transition-colors border ${
                    canvasEnv.mode === m 
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <ColorPicker 
              label="Primary Color"
              color={canvasEnv.colorA} 
              onChange={(c) => setCanvasEnv({ ...canvasEnv, colorA: c })} 
            />
            {canvasEnv.mode !== 'solid' && (
              <ColorPicker 
                label="Secondary Color"
                color={canvasEnv.colorB} 
                onChange={(c) => setCanvasEnv({ ...canvasEnv, colorB: c })} 
              />
            )}
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Pattern Overlay</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(['none', 'grid', 'dots', 'topographic', 'starfield'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setCanvasEnv({ ...canvasEnv, pattern: p })}
                  className={`py-1.5 rounded-md text-[10px] font-medium capitalize transition-colors border ${
                    canvasEnv.pattern === p 
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {canvasEnv.pattern !== 'none' && (
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Pattern Opacity</span>
                  <span className="text-white">{Math.round(canvasEnv.patternOpacity * 100)}%</span>
                </label>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={canvasEnv.patternOpacity} 
                  onChange={(e) => setCanvasEnv({...canvasEnv, patternOpacity: parseFloat(e.target.value)})}
                  className="w-full accent-blue-500"
                />
              </div>
            )}
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Post-Processing Texture</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['clean', 'grain', 'scanlines', 'halftone'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCanvasEnv({ ...canvasEnv, texture: t })}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium capitalize transition-colors border ${
                    canvasEnv.texture === t 
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {canvasEnv.texture !== 'clean' && (
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Intensity</span>
                  <span className="text-white">{canvasEnv.textureIntensity.toFixed(2)}</span>
                </label>
                <input 
                  type="range" min="0" max="2" step="0.05" 
                  value={canvasEnv.textureIntensity} 
                  onChange={(e) => setCanvasEnv({...canvasEnv, textureIntensity: parseFloat(e.target.value)})}
                  className="w-full accent-blue-500"
                />
              </div>
            )}
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              Vignette
            </label>
            <button
              onClick={() => setCanvasEnv({ ...canvasEnv, vignette: !canvasEnv.vignette })}
              className={`w-12 h-6 rounded-full transition-colors relative ${canvasEnv.vignette ? 'bg-pink-500' : 'bg-neutral-800'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${canvasEnv.vignette ? 'translate-x-7' : 'translate-x-1'}`}></div>
            </button>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
              Audio Reactive
            </label>
            <button
              onClick={() => {
                if (!canvasEnv.audioReactive) handleEnableMic();
                setCanvasEnv({ ...canvasEnv, audioReactive: !canvasEnv.audioReactive });
              }}
              className={`w-12 h-6 rounded-full transition-colors relative ${canvasEnv.audioReactive ? 'bg-pink-500' : 'bg-neutral-800'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${canvasEnv.audioReactive ? 'translate-x-7' : 'translate-x-1'}`}></div>
            </button>
          </div>

          <div className="w-full h-px bg-neutral-800 mb-6 shrink-0"></div>

          <div className="mb-6">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><Zap size={14} /> Performance Mode</span>
              <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">{fps} FPS</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPerformanceMode('high_quality')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors border ${
                  performanceMode === 'high_quality' 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                High Quality
              </button>
              <button
                onClick={() => setPerformanceMode('performance')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors border ${
                  performanceMode === 'performance' 
                    ? 'bg-green-600/20 border-green-500 text-green-400' 
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Optimized
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 mt-2 leading-tight">
              Optimized mode caches vectors to bitmaps and reduces texture noise octaves for low-end GPUs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasStudio;
