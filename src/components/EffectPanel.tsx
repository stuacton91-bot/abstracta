import React from 'react';
import type { ShapeEffect, EffectType } from '../store/useAppStore';
import { palettes } from '../store/palettes';
import { ColorPicker } from './ColorPicker';

export const effectTypes: EffectType[] = [
  'glass', 'mesh', 'holographic', 'noise', 
  'aberration', 'liquid', 'warp', 'duotone', 
  'neon', 'emboss', 'paper', 'halftone', 
  'sketch', 'oil', 'shadow'
];

interface EffectPanelProps {
  effect: ShapeEffect;
  onChange: (effect: ShapeEffect) => void;
  className?: string;
}

export const EffectPanel: React.FC<EffectPanelProps> = ({ effect, onChange, className = '' }) => {
  return (
    <div className={`space-y-6 flex-1 overflow-y-auto pr-2 pb-4 ${className}`}>
      <div>
        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Style</label>
        <div className="grid grid-cols-2 gap-2">
          {effectTypes.map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...effect, type: t })}
              className={`py-1.5 px-2 rounded-md text-xs font-medium capitalize transition-colors border ${
                effect.type === t 
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Intensity Slider */}
      {['noise', 'aberration', 'liquid', 'warp', 'neon', 'emboss', 'paper', 'halftone', 'sketch', 'oil', 'shadow'].includes(effect.type) && (
        <div>
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>Intensity / Amount</span>
            <span className="text-white">{effect.intensity.toFixed(2)}</span>
          </label>
          <input 
            type="range" min="0.1" max="5" step="0.1" 
            value={effect.intensity} 
            onChange={(e) => onChange({...effect, intensity: parseFloat(e.target.value)})}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Color Selectors */}
      {effect.type !== 'glass' && (
        <div className="space-y-4">
          <ColorPicker 
            label="Base Color"
            color={effect.colors[0] || '#ffffff'} 
            onChange={(c) => onChange({ ...effect, colors: [c, effect.colors[1] || '#aaaaaa', effect.colors[2] || c, effect.colors[3] || c] })} 
          />
          
          {['holographic', 'liquid', 'duotone', 'mesh'].includes(effect.type) && (
            <ColorPicker 
              label="Secondary Color"
              color={effect.colors[1] || '#aaaaaa'} 
              onChange={(c) => onChange({ ...effect, colors: [effect.colors[0] || '#ffffff', c, effect.colors[2] || c, effect.colors[3] || c] })} 
            />
          )}
        </div>
      )}

      {/* Opacity Slider */}
      {effect.type === 'glass' && (
        <div>
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>Opacity</span>
            <span className="text-white">{Math.round(effect.opacity * 100)}%</span>
          </label>
          <input 
            type="range" min="0" max="1" step="0.05" 
            value={effect.opacity} 
            onChange={(e) => onChange({...effect, opacity: parseFloat(e.target.value)})}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Palette Selector */}
      {effect.type !== 'glass' && effect.type !== 'noise' && effect.type !== 'sketch' && (
        <div>
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 block">Color System (OKLCH)</label>
          <div className="grid grid-cols-4 gap-2">
            {palettes.map((palette, i) => (
              <button 
                key={i}
                title={palette.name}
                onClick={() => onChange({...effect, colors: palette.meshStops})}
                className={`h-8 rounded-md flex overflow-hidden border-2 transition-transform hover:scale-105 ${
                  effect.colors[0] === palette.meshStops[0] ? 'border-white' : 'border-transparent'
                }`}
              >
                {palette.meshStops.map((c, j) => <div key={j} className="flex-1 h-full" style={{backgroundColor: c}}></div>)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
