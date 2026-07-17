import React, { useState, useEffect, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Pipette, Plus, Hash } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_PALETTES = {
  Neon: ['#ff00ff', '#00ffff', '#00ff00', '#ffff00', '#ff0055'],
  Metals: ['#ffd700', '#e5e4e2', '#cd7f32', '#b87333', '#8a9a5b'],
  Cyberpunk: ['#711c91', '#ea00d9', '#0abdc6', '#133e7c', '#091833'],
};

// Simple utility to convert hex to HSL for harmonies
const hexToHSL = (hex: string) => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
};

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { savedSwatches, addSavedSwatch } = useAppStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        onChange(result.sRGBHex);
      } catch (e) {
        // User canceled or error
      }
    } else {
      alert("Your browser does not support the EyeDropper API.");
    }
  };

  const getHarmonies = (baseHex: string) => {
    try {
      const { h, s, l } = hexToHSL(baseHex);
      const sPerc = s * 100;
      const lPerc = l * 100;
      return [
        hslToHex((h + 180) % 360, sPerc, lPerc), // Complementary
        hslToHex((h + 30) % 360, sPerc, lPerc),  // Analogous Right
        hslToHex((h + 330) % 360, sPerc, lPerc), // Analogous Left
        hslToHex((h + 120) % 360, sPerc, lPerc), // Triadic 1
      ];
    } catch {
      return [];
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {label && <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">{label}</label>}
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-lg border border-neutral-700 shadow-inner flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 flex items-center bg-neutral-900 border border-neutral-800 rounded-lg px-3 gap-2">
          <Hash size={14} className="text-neutral-500" />
          <input
            type="text"
            value={color.replace('#', '')}
            onChange={(e) => {
              const val = '#' + e.target.value.replace('#', '');
              if (/^#[0-9A-F]{6}$/i.test(val)) onChange(val);
            }}
            className="bg-transparent border-none text-white w-full text-sm outline-none font-mono uppercase"
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-12 left-0 z-50 bg-neutral-900 border border-neutral-800 p-4 rounded-xl shadow-2xl w-64">
          <HexColorPicker color={color} onChange={onChange} className="!w-full mb-4" />
          
          <div className="flex justify-between items-center mb-4">
            <button onClick={handleEyeDropper} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors" title="Pick color from screen">
              <Pipette size={16} />
            </button>
            <button onClick={() => addSavedSwatch(color)} className="flex items-center gap-1 text-xs bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-colors">
              <Plus size={14} /> Save
            </button>
          </div>

          <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
            {savedSwatches.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Saved</h4>
                <div className="flex flex-wrap gap-2">
                  {savedSwatches.map((swatch, i) => (
                    <button key={i} className="w-6 h-6 rounded-md border border-neutral-700" style={{ backgroundColor: swatch }} onClick={() => onChange(swatch)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Harmonies</h4>
              <div className="flex gap-2">
                {getHarmonies(color).map((harmony, i) => (
                  <button key={i} className="w-6 h-6 rounded-md border border-neutral-700" style={{ backgroundColor: harmony }} onClick={() => onChange(harmony)} title={['Complementary', 'Analogous R', 'Analogous L', 'Triadic'][i]} />
                ))}
              </div>
            </div>

            {Object.entries(PRESET_PALETTES).map(([name, colors]) => (
              <div key={name}>
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">{name}</h4>
                <div className="flex gap-2">
                  {colors.map((presetColor, i) => (
                    <button key={i} className="w-6 h-6 rounded-md border border-neutral-700" style={{ backgroundColor: presetColor }} onClick={() => onChange(presetColor)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
