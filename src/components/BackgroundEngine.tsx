import React, { useMemo, useEffect, useRef } from 'react';
import { Image as KonvaImage, Rect, Group } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import type { CanvasEnvironment } from '../store/useAppStore';
import { audioAnalyzer } from '../lib/audioAnalyzer';

interface BackgroundEngineProps {
  width: number;
  height: number;
  env: CanvasEnvironment;
  performanceMode?: 'high_quality' | 'performance';
}

const BackgroundEngine: React.FC<BackgroundEngineProps> = ({ width, height, env, performanceMode = 'high_quality' }) => {
  const groupRef = useRef<Konva.Group>(null);
  const vignetteRef = useRef<Konva.Rect>(null);

  // 1. Base Fill (Solid, Linear, Radial)
  const baseProps = useMemo(() => {
    if (env.mode === 'linear') {
      return {
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: width, y: height },
        fillLinearGradientColorStops: [0, env.colorA, 1, env.colorB],
      };
    } else if (env.mode === 'radial') {
      return {
        fillRadialGradientStartPoint: { x: width / 2, y: height / 2 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndPoint: { x: width / 2, y: height / 2 },
        fillRadialGradientEndRadius: Math.max(width, height) / 1.5,
        fillRadialGradientColorStops: [0, env.colorA, 1, env.colorB],
      };
    }
    // Solid
    return { fill: env.colorA };
  }, [env.mode, env.colorA, env.colorB, width, height]);

  // 2. Holographic Fluid Mesh Overlay
  const holographicSvgUrl = useMemo(() => {
    if (env.mode !== 'holographic') return null;
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="${width * 0.1}" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="${env.colorA}" />
      <circle cx="20%" cy="30%" r="${width * 0.4}" fill="${env.colorB}" filter="url(#blur)" opacity="0.8" />
      <circle cx="80%" cy="70%" r="${width * 0.4}" fill="${env.colorB}" filter="url(#blur)" opacity="0.6" />
      <circle cx="50%" cy="50%" r="${width * 0.5}" fill="${env.colorA}" filter="url(#blur)" opacity="0.7" />
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  }, [env.mode, env.colorA, env.colorB, width, height]);
  const [holoImage] = useImage(holographicSvgUrl || '');

  // 3. Generative Patterns (Grid, Dots, Topographic, Starfield)
  const patternSvgUrl = useMemo(() => {
    if (env.pattern === 'none') return null;
    let svgContent = '';

    if (env.pattern === 'grid') {
      const size = 40;
      svgContent = `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <path d="M ${size} 0 L 0 0 0 ${size}" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#p)" />`;
    } 
    else if (env.pattern === 'dots') {
      const size = 20;
      svgContent = `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
        <circle cx="${size/2}" cy="${size/2}" r="1" fill="white" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#p)" />`;
    }
    else if (env.pattern === 'topographic') {
      // Procedural SVG filter for topographic lines
      const octaves = performanceMode === 'performance' ? "1" : "3";
      svgContent = `
        <filter id="topo">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="${octaves}" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 20 -9" result="highContrast" />
          <feComponentTransfer><feFuncA type="table" tableValues="1 0 1 0 1 0 1 0 1" /></feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter="url(#topo)" fill="white" opacity="0.5" />
      `;
    }
    else if (env.pattern === 'starfield') {
      // Small procedural noise for stars
      svgContent = `
        <filter id="stars">
          <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" />
          <feColorMatrix type="matrix" values="1 0 0 0 0, 1 0 0 0 0, 1 0 0 0 0, 0 0 0 40 -19" />
        </filter>
        <rect width="100%" height="100%" filter="url(#stars)" fill="white" />
      `;
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgContent}</svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  }, [env.pattern, width, height]);
  const [patternImage] = useImage(patternSvgUrl || '');

  // 4. Textures (Grain, Scanlines, Halftone)
  const textureSvgUrl = useMemo(() => {
    if (env.texture === 'clean' || env.textureIntensity <= 0) return null;
    let filterContent = '';

    if (env.texture === 'grain') {
      const octaves = performanceMode === 'performance' ? "1" : "3";
      filterContent = `
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="${octaves}" stitchTiles="stitch"/>
        <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 ${env.textureIntensity} 0" />
      `;
    } 
    else if (env.texture === 'scanlines') {
      const size = 4;
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <pattern id="scan" width="1" height="${size}" patternUnits="userSpaceOnUse">
            <rect width="100%" height="${size/2}" fill="black" opacity="${env.textureIntensity}" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#scan)" />
        </svg>
      `)))}`;
    }
    else if (env.texture === 'halftone') {
      // Simulating halftone dots via noise and color matrix
      filterContent = `
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" />
        <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 ${env.textureIntensity * 2} -${env.textureIntensity}" />
      `;
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <filter id="tex">${filterContent}</filter>
      <rect width="100%" height="100%" filter="url(#tex)"/>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  }, [env.texture, env.textureIntensity, width, height]);
  const [textureImage] = useImage(textureSvgUrl || '');

  // 5. Audio Reactivity Loop
  useEffect(() => {
    if (!env.audioReactive || !groupRef.current || !vignetteRef.current) return;
    
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      if (audioAnalyzer.getIsInitialized()) {
        const audio = audioAnalyzer.getAudioData();
        const bassPulse = audio.bass * 0.3; // 0 to 0.3
        
        // Pulse the vignette
        if (env.vignette) {
          vignetteRef.current?.opacity(0.5 + bassPulse);
        }
        
        // Slightly scale the pattern to the beat
        if (groupRef.current) {
          const s = 1 + (audio.bass * 0.05);
          groupRef.current.scale({ x: s, y: s });
          groupRef.current.offsetX((width * s - width) / 2);
          groupRef.current.offsetY((height * s - height) / 2);
        }
      }
    }, groupRef.current.getLayer());

    anim.start();
    return () => {
      anim.stop();
      if (vignetteRef.current) vignetteRef.current.opacity(0.5);
      if (groupRef.current) {
        groupRef.current.scale({ x: 1, y: 1 });
        groupRef.current.offsetX(0);
        groupRef.current.offsetY(0);
      }
    };
  }, [env.audioReactive, env.vignette, width, height]);

  // Vignette gradient
  const vignetteProps = useMemo(() => {
    return {
      fillRadialGradientStartPoint: { x: width / 2, y: height / 2 },
      fillRadialGradientStartRadius: width * 0.2,
      fillRadialGradientEndPoint: { x: width / 2, y: height / 2 },
      fillRadialGradientEndRadius: Math.max(width, height) * 0.8,
      fillRadialGradientColorStops: [0, 'transparent', 1, 'rgba(0,0,0,1)'],
    };
  }, [width, height]);

  return (
    <Group id="background-engine">
      {/* 1. Base Fill */}
      <Rect x={0} y={0} width={width} height={height} id="bg-rect" {...baseProps} />
      
      {/* 2. Holographic Overlay */}
      {env.mode === 'holographic' && holoImage && (
        <KonvaImage image={holoImage} width={width} height={height} listening={false} />
      )}

      {/* Group for Audio Reactivity (Patterns) */}
      <Group ref={groupRef} listening={false}>
        {/* 3. Generative Pattern */}
        {env.pattern !== 'none' && patternImage && (
          <KonvaImage 
            image={patternImage} 
            width={width} 
            height={height} 
            opacity={env.patternOpacity}
            globalCompositeOperation="overlay" 
          />
        )}
      </Group>

      {/* 4. Vignette */}
      {env.vignette && (
        <Rect ref={vignetteRef} x={0} y={0} width={width} height={height} {...vignetteProps} listening={false} opacity={0.5} />
      )}

      {/* 5. Post-Processing Texture */}
      {env.texture !== 'clean' && textureImage && (
        <KonvaImage 
          image={textureImage} 
          width={width} 
          height={height} 
          listening={false} 
          globalCompositeOperation={env.texture === 'scanlines' ? 'multiply' : 'soft-light'} 
        />
      )}
    </Group>
  );
};

export default BackgroundEngine;
