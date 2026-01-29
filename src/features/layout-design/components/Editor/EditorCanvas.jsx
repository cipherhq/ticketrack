/**
 * Editor Canvas
 * Main 2D canvas for layout editing (simplified SVG-based implementation)
 */

import { forwardRef, useRef, useState, useCallback, useEffect } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';

const OBJECT_COLORS = {
  stage: '#1F2937',
  section: '#3B82F6',
  vip_section: '#EF4444',
  table: '#8B5CF6',
  zone: '#10B981',
  entrance: '#22C55E',
  exit: '#EF4444',
  bar: '#F59E0B',
  restroom: '#6B7280',
  barrier: '#9CA3AF',
  restricted: '#DC2626',
};

export const EditorCanvas = forwardRef((props, ref) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const {
    layout,
    objects,
    selectedIds,
    canvas,
    select,
    clearSelection,
    updateObject,
    setZoom,
    setPan,
    pushHistory,
  } = useLayoutStore();

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Expose SVG ref for export
  useEffect(() => {
    if (ref) {
      ref.current = svgRef.current;
    }
  }, [ref]);

  const canvasWidth = layout?.canvas_width || 800;
  const canvasHeight = layout?.canvas_height || 600;

  // Transform coordinates
  const getTransformedPoint = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      const rect = svg.getBoundingClientRect();
      const x = (clientX - rect.left - canvas.panX) / canvas.zoom;
      const y = (clientY - rect.top - canvas.panY) / canvas.zoom;
      return { x, y };
    },
    [canvas.zoom, canvas.panX, canvas.panY]
  );

  // Snap to grid
  const snapToGrid = useCallback(
    (value) => {
      if (!canvas.snapToGrid) return value;
      return Math.round(value / canvas.gridSize) * canvas.gridSize;
    },
    [canvas.snapToGrid, canvas.gridSize]
  );

  // Handle object drag
  const handleMouseDown = useCallback(
    (e, obj) => {
      e.stopPropagation();
      const point = getTransformedPoint(e.clientX, e.clientY);

      // Check if clicking on resize handle
      if (e.target.classList.contains('resize-handle')) {
        setResizing({
          id: obj.id,
          startX: point.x,
          startY: point.y,
          startWidth: obj.width,
          startHeight: obj.height,
        });
        return;
      }

      // Start dragging
      setDragging(obj.id);
      setDragOffset({
        x: point.x - obj.x,
        y: point.y - obj.y,
      });
      select(obj.id);
    },
    [getTransformedPoint, select]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const point = getTransformedPoint(e.clientX, e.clientY);

      if (dragging) {
        const newX = snapToGrid(point.x - dragOffset.x);
        const newY = snapToGrid(point.y - dragOffset.y);
        updateObject(dragging, { x: newX, y: newY });
      }

      if (resizing) {
        const dx = point.x - resizing.startX;
        const dy = point.y - resizing.startY;
        const newWidth = snapToGrid(Math.max(20, resizing.startWidth + dx));
        const newHeight = snapToGrid(Math.max(20, resizing.startHeight + dy));
        updateObject(resizing.id, { width: newWidth, height: newHeight });
      }
    },
    [dragging, resizing, dragOffset, getTransformedPoint, snapToGrid, updateObject]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging || resizing) {
      pushHistory();
    }
    setDragging(null);
    setResizing(null);
  }, [dragging, resizing, pushHistory]);

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(
    (e) => {
      if (e.target === svgRef.current || e.target.classList.contains('canvas-bg')) {
        clearSelection();
      }
    },
    [clearSelection]
  );

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(canvas.zoom + delta);
    },
    [canvas.zoom, setZoom]
  );

  // Render grid
  const renderGrid = () => {
    if (!canvas.gridVisible) return null;

    const gridLines = [];
    const step = canvas.gridSize;

    for (let x = 0; x <= canvasWidth; x += step) {
      gridLines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasHeight}
          stroke="#E5E7EB"
          strokeWidth={0.5 / canvas.zoom}
        />
      );
    }

    for (let y = 0; y <= canvasHeight; y += step) {
      gridLines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={canvasWidth}
          y2={y}
          stroke="#E5E7EB"
          strokeWidth={0.5 / canvas.zoom}
        />
      );
    }

    return <g className="grid">{gridLines}</g>;
  };

  // Render object
  const renderObject = (obj) => {
    const isSelected = selectedIds.includes(obj.id);
    const color = obj.color || OBJECT_COLORS[obj.object_type] || '#3B82F6';

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
        onMouseDown={(e) => handleMouseDown(e, obj)}
        style={{ cursor: dragging === obj.id ? 'grabbing' : 'grab' }}
      >
        {/* Object shape */}
        {obj.shape === 'circle' ? (
          <ellipse
            cx={obj.width / 2}
            cy={obj.height / 2}
            rx={obj.width / 2}
            ry={obj.height / 2}
            fill={color}
            fillOpacity={0.8}
            stroke={isSelected ? '#2969FF' : color}
            strokeWidth={isSelected ? 3 / canvas.zoom : 1 / canvas.zoom}
          />
        ) : (
          <rect
            width={obj.width}
            height={obj.height}
            rx={4}
            fill={color}
            fillOpacity={0.8}
            stroke={isSelected ? '#2969FF' : color}
            strokeWidth={isSelected ? 3 / canvas.zoom : 1 / canvas.zoom}
          />
        )}

        {/* Label */}
        <text
          x={obj.width / 2}
          y={obj.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={14 / canvas.zoom}
          fontWeight="500"
          pointerEvents="none"
        >
          {obj.name || obj.object_type}
        </text>

        {/* Capacity badge */}
        {obj.capacity && (
          <text
            x={obj.width / 2}
            y={obj.height / 2 + 16 / canvas.zoom}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={11 / canvas.zoom}
            opacity={0.9}
            pointerEvents="none"
          >
            {obj.capacity} capacity
          </text>
        )}

        {/* Resize handle */}
        {isSelected && (
          <rect
            className="resize-handle"
            x={obj.width - 8 / canvas.zoom}
            y={obj.height - 8 / canvas.zoom}
            width={16 / canvas.zoom}
            height={16 / canvas.zoom}
            fill="#2969FF"
            stroke="white"
            strokeWidth={1 / canvas.zoom}
            style={{ cursor: 'nwse-resize' }}
          />
        )}
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        style={{ backgroundColor: '#F3F4F6' }}
      >
        <g
          transform={`translate(${canvas.panX + (dimensions.width - canvasWidth * canvas.zoom) / 2}, ${canvas.panY + (dimensions.height - canvasHeight * canvas.zoom) / 2}) scale(${canvas.zoom})`}
        >
          {/* Canvas background */}
          <rect
            className="canvas-bg"
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="white"
            stroke="#D1D5DB"
            strokeWidth={1 / canvas.zoom}
          />

          {/* Grid */}
          {renderGrid()}

          {/* Objects */}
          {objects
            .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
            .map(renderObject)}
        </g>
      </svg>
    </div>
  );
});

EditorCanvas.displayName = 'EditorCanvas';
