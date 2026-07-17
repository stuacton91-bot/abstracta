import { create } from 'zustand';
import { db } from '../lib/firebase';
import { ref, set as firebaseSet, update, remove } from 'firebase/database';

export interface Point {
  x: number;
  y: number;
}

export type EffectType = 
  | 'glass' | 'mesh' | 'holographic' | 'noise' 
  | 'aberration' | 'liquid' | 'warp' | 'duotone' 
  | 'neon' | 'emboss' | 'paper' | 'halftone' 
  | 'sketch' | 'oil' | 'shadow';

export interface ShapeEffect {
  type: EffectType;
  colors: string[]; 
  opacity: number;
  intensity: number; 
}

export type BehaviorType = 'none' | 'float' | 'pulse' | 'spin' | 'orbit';

export interface CustomShape {
  id: string;
  points: Point[];
  effect: ShapeEffect;
}

export interface CanvasObject {
  id: string;
  shapeId: string; 
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  overrideEffect?: ShapeEffect; 
  behavior?: BehaviorType;
  audioReactive?: boolean;
}

export interface CanvasEnvironment {
  mode: 'solid' | 'linear' | 'radial' | 'holographic';
  colorA: string;
  colorB: string;
  pattern: 'none' | 'grid' | 'dots' | 'topographic' | 'starfield';
  patternOpacity: number;
  texture: 'clean' | 'grain' | 'scanlines' | 'halftone';
  textureIntensity: number;
  vignette: boolean;
  audioReactive: boolean;
}

interface AppState {
  roomId: string | null;
  setRoomId: (id: string | null) => void;

  library: CustomShape[];
  addShapeToLibrary: (shape: CustomShape) => void;
  removeShapeFromLibrary: (id: string) => void;
  setLibrary: (shapes: CustomShape[]) => void;

  canvasObjects: CanvasObject[];
  addCanvasObject: (obj: CanvasObject) => void;
  updateCanvasObject: (id: string, updates: Partial<CanvasObject>) => void;
  removeCanvasObject: (id: string) => void;
  setCanvasObjects: (objects: CanvasObject[]) => void;

  canvasEnv: CanvasEnvironment;
  setCanvasEnv: (env: CanvasEnvironment | ((prev: CanvasEnvironment) => CanvasEnvironment)) => void;

  savedSwatches: string[];
  addSavedSwatch: (color: string) => void;

  history: CanvasObject[][];
  future: CanvasObject[][];
  saveHistoryState: () => void;
  undo: () => void;
  redo: () => void;

  performanceMode: 'high_quality' | 'performance';
  setPerformanceMode: (mode: 'high_quality' | 'performance') => void;
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
    performanceMode: 'high_quality',
    setPerformanceMode: (mode) => set({ performanceMode: mode }),

    roomId: null,
    setRoomId: (id) => set({ roomId: id }),

    library: [],
    addShapeToLibrary: (shape) => {
      const state = get();
      if (state.roomId) {
        firebaseSet(ref(db, `rooms/${state.roomId}/library/${shape.id}`), shape);
      }
    },
    removeShapeFromLibrary: (id) => {
      const state = get();
      if (state.roomId) {
        remove(ref(db, `rooms/${state.roomId}/library/${id}`));
      }
    },
    setLibrary: (shapes) => {
      const state = get();
      if (state.roomId) {
        if (shapes.length === 0) {
          firebaseSet(ref(db, `rooms/${state.roomId}/library`), null);
        } else {
          const objMap: Record<string, CustomShape> = {};
          shapes.forEach(s => objMap[s.id] = s);
          firebaseSet(ref(db, `rooms/${state.roomId}/library`), objMap);
        }
      }
    },

    canvasObjects: [],
    addCanvasObject: (obj) => {
      const state = get();
      if (state.roomId) {
        firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects/${obj.id}`), obj);
      }
    },
    updateCanvasObject: (id, updates) => {
      const state = get();
      if (state.roomId) {
        update(ref(db, `rooms/${state.roomId}/canvasObjects/${id}`), updates);
      }
    },
    removeCanvasObject: (id) => {
      const state = get();
      if (state.roomId) {
        remove(ref(db, `rooms/${state.roomId}/canvasObjects/${id}`));
      }
    },
    setCanvasObjects: (objects) => {
      const state = get();
      if (state.roomId) {
        if (objects.length === 0) {
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), null);
        } else {
          const objMap: Record<string, CanvasObject> = {};
          objects.forEach(o => objMap[o.id] = o);
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), objMap);
        }
      }
    },

    canvasEnv: {
      mode: 'solid',
      colorA: '#0f0f13',
      colorB: '#1a1a2e',
      pattern: 'none',
      patternOpacity: 0.1,
      texture: 'grain',
      textureIntensity: 0.15,
      vignette: true,
      audioReactive: false,
    },
    setCanvasEnv: (envOrUpdater) => {
      const state = get();
      const newEnv = typeof envOrUpdater === 'function' ? envOrUpdater(state.canvasEnv) : envOrUpdater;
      if (state.roomId) {
        firebaseSet(ref(db, `rooms/${state.roomId}/canvasEnv`), newEnv);
      } else {
        set({ canvasEnv: newEnv });
      }
    },

    savedSwatches: [],
    addSavedSwatch: (color) => set((state) => ({ 
      savedSwatches: [...new Set([color, ...state.savedSwatches])].slice(0, 10) 
    })),

    history: [],
    future: [],
    saveHistoryState: () => {
      const state = get();
      const newHistory = [...state.history, [...state.canvasObjects]];
      // keep only the last 3 steps
      if (newHistory.length > 3) newHistory.shift();
      set({ history: newHistory, future: [] });
    },
    undo: () => {
      const state = get();
      if (state.history.length === 0) return;
      const newHistory = [...state.history];
      const previousState = newHistory.pop()!;
      const newFuture = [state.canvasObjects, ...state.future];
      // Keep only 3 future steps
      if (newFuture.length > 3) newFuture.pop();
      set({ history: newHistory, future: newFuture });
      
      // sync to firebase
      if (state.roomId) {
        if (previousState.length === 0) {
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), null);
        } else {
          const objMap: Record<string, CanvasObject> = {};
          previousState.forEach(o => objMap[o.id] = o);
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), objMap);
        }
      }
    },
    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      const newFuture = [...state.future];
      const nextState = newFuture.shift()!;
      const newHistory = [...state.history, state.canvasObjects];
      if (newHistory.length > 3) newHistory.shift();
      set({ history: newHistory, future: newFuture });
      
      // sync to firebase
      if (state.roomId) {
        if (nextState.length === 0) {
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), null);
        } else {
          const objMap: Record<string, CanvasObject> = {};
          nextState.forEach(o => objMap[o.id] = o);
          firebaseSet(ref(db, `rooms/${state.roomId}/canvasObjects`), objMap);
        }
      }
    }
  })
);
