/**
 * 3D Preview
 * Three.js based 3D visualization of the layout
 * Note: Requires @react-three/fiber and @react-three/drei packages
 */

import { Suspense, useState, useRef } from 'react';
import { ArrowLeft, RotateCcw, Tag, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutStore } from '../../stores/layoutStore';

// Fallback 3D preview using CSS 3D transforms (no Three.js dependency)
export function Preview3D() {
  const { objects, layout, setActiveView } = useLayoutStore();
  const [showLabels, setShowLabels] = useState(true);
  const [rotation, setRotation] = useState({ x: 45, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef();
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const canvasWidth = layout?.canvas_width || 800;
  const canvasHeight = layout?.canvas_height || 600;
  const scale = 0.3; // Scale down for 3D view

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;

    setRotation((prev) => ({
      x: Math.max(10, Math.min(80, prev.x - dy * 0.5)),
      y: prev.y + dx * 0.5,
    }));

    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(2, prev + delta)));
  };

  const resetView = () => {
    setRotation({ x: 45, y: 0 });
    setZoom(1);
  };

  const getObjectHeight = (obj) => {
    switch (obj.object_type) {
      case 'stage':
        return 40;
      case 'section':
      case 'vip_section':
        return 20;
      case 'table':
        return 25;
      case 'zone':
        return 5;
      case 'entrance':
      case 'exit':
        return 60;
      case 'barrier':
        return 30;
      default:
        return 15;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-800 to-gray-900">
      {/* Header */}
      <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-4">
        <Button
          variant="ghost"
          className="text-white hover:bg-gray-800"
          onClick={() => setActiveView('2d')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to 2D Editor
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800"
          onClick={() => setShowLabels(!showLabels)}
        >
          {showLabels ? (
            <Eye className="w-4 h-4 mr-2" />
          ) : (
            <EyeOff className="w-4 h-4 mr-2" />
          )}
          Labels
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800"
          onClick={resetView}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
      </div>

      {/* 3D Scene */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            perspective: '1000px',
            perspectiveOrigin: '50% 50%',
          }}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              transform: `
                scale(${zoom})
                rotateX(${rotation.x}deg)
                rotateZ(${rotation.y}deg)
              `,
              transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Floor */}
            <div
              className="absolute bg-gray-200 border border-gray-300"
              style={{
                width: canvasWidth * scale,
                height: canvasHeight * scale,
                transform: 'translateZ(0)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              }}
            >
              {/* Grid lines */}
              <svg
                className="absolute inset-0"
                width="100%"
                height="100%"
                style={{ opacity: 0.3 }}
              >
                {Array.from({ length: Math.ceil(canvasWidth / 50) }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={`${(i * 50 * scale / (canvasWidth * scale)) * 100}%`}
                    y1="0"
                    x2={`${(i * 50 * scale / (canvasWidth * scale)) * 100}%`}
                    y2="100%"
                    stroke="#999"
                    strokeWidth="0.5"
                  />
                ))}
                {Array.from({ length: Math.ceil(canvasHeight / 50) }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    y1={`${(i * 50 * scale / (canvasHeight * scale)) * 100}%`}
                    x2="100%"
                    y2={`${(i * 50 * scale / (canvasHeight * scale)) * 100}%`}
                    stroke="#999"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>
            </div>

            {/* Objects */}
            {objects.map((obj) => {
              const height = getObjectHeight(obj);
              const x = obj.x * scale;
              const y = obj.y * scale;
              const width = obj.width * scale;
              const depth = obj.height * scale;

              return (
                <div
                  key={obj.id}
                  className="absolute"
                  style={{
                    left: x,
                    top: y,
                    width: width,
                    height: depth,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Top face */}
                  <div
                    className="absolute"
                    style={{
                      width: width,
                      height: depth,
                      backgroundColor: obj.color || '#3B82F6',
                      transform: `translateZ(${height}px)`,
                      borderRadius: obj.shape === 'circle' ? '50%' : '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 0 20px rgba(255,255,255,0.2)',
                    }}
                  >
                    {showLabels && (
                      <span
                        className="text-white text-xs font-medium text-center px-1"
                        style={{
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                          transform: `rotateX(-${rotation.x}deg) rotateZ(-${rotation.y}deg)`,
                        }}
                      >
                        {obj.name || obj.object_type}
                      </span>
                    )}
                  </div>

                  {/* Front face */}
                  <div
                    className="absolute"
                    style={{
                      width: width,
                      height: height,
                      backgroundColor: obj.color || '#3B82F6',
                      transform: `rotateX(-90deg) translateZ(${depth / 2}px)`,
                      transformOrigin: 'top',
                      filter: 'brightness(0.7)',
                      borderRadius: obj.shape === 'circle' ? '4px 4px 50% 50%' : '0 0 4px 4px',
                    }}
                  />

                  {/* Right face */}
                  <div
                    className="absolute"
                    style={{
                      width: depth,
                      height: height,
                      backgroundColor: obj.color || '#3B82F6',
                      transform: `rotateY(90deg) rotateX(-90deg) translateZ(${width / 2}px)`,
                      transformOrigin: 'left',
                      filter: 'brightness(0.5)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-4 py-2 rounded-full">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
