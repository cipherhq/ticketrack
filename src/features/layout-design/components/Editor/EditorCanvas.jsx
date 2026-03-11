/**
 * Editor Canvas
 * Main 2D canvas for layout editing (SVG-based with rich object rendering)
 */

import { forwardRef, useRef, useState, useCallback, useEffect } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { SVG_DEFS, OBJECT_COLORS, renderObjectSVG } from './objectRenderers';

// Resize handle positions: [id, xFrac, yFrac, cursor]
const HANDLES = [
  ['nw', 0, 0, 'nwse-resize'],
  ['n', 0.5, 0, 'ns-resize'],
  ['ne', 1, 0, 'nesw-resize'],
  ['e', 1, 0.5, 'ew-resize'],
  ['se', 1, 1, 'nwse-resize'],
  ['s', 0.5, 1, 'ns-resize'],
  ['sw', 0, 1, 'nesw-resize'],
  ['w', 0, 0.5, 'ew-resize'],
];

export const EditorCanvas = forwardRef((props, ref) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoverObj, setHoverObj] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

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
      const x = (clientX - rect.left - canvas.panX - (dimensions.width - canvasWidth * canvas.zoom) / 2) / canvas.zoom;
      const y = (clientY - rect.top - canvas.panY - (dimensions.height - canvasHeight * canvas.zoom) / 2) / canvas.zoom;
      return { x, y };
    },
    [canvas.zoom, canvas.panX, canvas.panY, dimensions, canvasWidth, canvasHeight]
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

      // Check if clicking on a resize handle
      const handleId = e.target.dataset?.handle;
      if (handleId) {
        setResizing({
          id: obj.id,
          handle: handleId,
          startX: point.x,
          startY: point.y,
          origX: obj.x,
          origY: obj.y,
          origW: obj.width,
          origH: obj.height,
        });
        setHoverObj(null);
        return;
      }

      // Start dragging
      setDragging(obj.id);
      setDragOffset({
        x: point.x - obj.x,
        y: point.y - obj.y,
      });
      setHoverObj(null);
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
        return;
      }

      if (resizing) {
        const dx = point.x - resizing.startX;
        const dy = point.y - resizing.startY;
        const h = resizing.handle;
        let newX = resizing.origX;
        let newY = resizing.origY;
        let newW = resizing.origW;
        let newH = resizing.origH;

        // Horizontal
        if (h.includes('w')) {
          newW = snapToGrid(Math.max(20, resizing.origW - dx));
          newX = snapToGrid(resizing.origX + resizing.origW - newW);
        } else if (h.includes('e')) {
          newW = snapToGrid(Math.max(20, resizing.origW + dx));
        }

        // Vertical
        if (h.includes('n')) {
          newH = snapToGrid(Math.max(20, resizing.origH - dy));
          newY = snapToGrid(resizing.origY + resizing.origH - newH);
        } else if (h.includes('s')) {
          newH = snapToGrid(Math.max(20, resizing.origH + dy));
        }

        updateObject(resizing.id, { x: newX, y: newY, width: newW, height: newH });
        return;
      }

      // Track hover position for tooltip
      setHoverPos({ x: e.clientX, y: e.clientY });
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
      if (e.target === svgRef.current || e.target.classList.contains('canvas-bg') || e.target.classList.contains('dot-grid-bg')) {
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

  // Render dot grid
  const renderGrid = () => {
    if (!canvas.gridVisible) return null;
    return (
      <rect
        className="dot-grid-bg"
        x={0}
        y={0}
        width={canvasWidth}
        height={canvasHeight}
        fill="url(#pattern-dot-grid)"
      />
    );
  };

  // Render selection outline + 8 handles
  const renderSelection = (obj) => {
    const handleSize = 8 / canvas.zoom;
    const half = handleSize / 2;

    return (
      <>
        {/* Animated dashed border */}
        <rect
          x={-2 / canvas.zoom}
          y={-2 / canvas.zoom}
          width={obj.width + 4 / canvas.zoom}
          height={obj.height + 4 / canvas.zoom}
          rx={4}
          fill="none"
          stroke="#2969FF"
          strokeWidth={2 / canvas.zoom}
          strokeDasharray={`${6 / canvas.zoom} ${3 / canvas.zoom}`}
          pointerEvents="none"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={9 / canvas.zoom}
            to={0}
            dur="0.5s"
            repeatCount="indefinite"
          />
        </rect>

        {/* 8 resize handles */}
        {HANDLES.map(([id, xFrac, yFrac, cursor]) => (
          <rect
            key={id}
            data-handle={id}
            x={obj.width * xFrac - half}
            y={obj.height * yFrac - half}
            width={handleSize}
            height={handleSize}
            rx={2 / canvas.zoom}
            fill="white"
            stroke="#2969FF"
            strokeWidth={1.5 / canvas.zoom}
            style={{ cursor }}
          />
        ))}
      </>
    );
  };

  // Render capacity badge (pill at top-right)
  const renderCapacityBadge = (obj) => {
    if (!obj.capacity) return null;
    const color = obj.color || OBJECT_COLORS[obj.object_type] || '#3B82F6';
    const text = `${obj.capacity}`;
    const badgeW = Math.max(24, text.length * 8 + 10) / canvas.zoom;
    const badgeH = 18 / canvas.zoom;
    const badgeX = obj.width - badgeW + 4 / canvas.zoom;
    const badgeY = -badgeH / 2;

    return (
      <g pointerEvents="none">
        <rect
          x={badgeX}
          y={badgeY}
          width={badgeW}
          height={badgeH}
          rx={badgeH / 2}
          fill="white"
          stroke={color}
          strokeWidth={1 / canvas.zoom}
        />
        <text
          x={badgeX + badgeW / 2}
          y={badgeY + badgeH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={10 / canvas.zoom}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {text}
        </text>
      </g>
    );
  };

  // Render a single object
  const renderObject = (obj) => {
    const isSelected = selectedIds.includes(obj.id);
    const isHovered = hoverObj === obj.id && !dragging && !resizing;

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y})${obj.rotation ? ` rotate(${obj.rotation}, ${obj.width / 2}, ${obj.height / 2})` : ''}`}
        onMouseDown={(e) => handleMouseDown(e, obj)}
        onMouseEnter={() => { if (!dragging && !resizing) setHoverObj(obj.id); }}
        onMouseLeave={() => setHoverObj(null)}
        style={{ cursor: dragging === obj.id ? 'grabbing' : 'grab' }}
      >
        {/* Type-specific SVG rendering */}
        {renderObjectSVG(obj, {
          fontSize: 13 / canvas.zoom,
          iconScale: Math.min(obj.width, obj.height) / 80,
        })}

        {/* Capacity badge */}
        {renderCapacityBadge(obj)}

        {/* Selection overlay */}
        {isSelected && renderSelection(obj)}

        {/* Hover highlight */}
        {isHovered && !isSelected && (
          <rect
            x={-1 / canvas.zoom}
            y={-1 / canvas.zoom}
            width={obj.width + 2 / canvas.zoom}
            height={obj.height + 2 / canvas.zoom}
            rx={4}
            fill="none"
            stroke="#2969FF"
            strokeWidth={1.5 / canvas.zoom}
            strokeOpacity={0.5}
            pointerEvents="none"
          />
        )}
      </g>
    );
  };

  // Hover tooltip (rendered in screen space)
  const renderTooltip = () => {
    if (!hoverObj || dragging || resizing) return null;
    const obj = objects.find((o) => o.id === hoverObj);
    if (!obj) return null;

    const label = obj.name || obj.object_type?.replace(/_/g, ' ');
    const cap = obj.capacity ? ` \u00B7 ${obj.capacity} cap` : '';

    return (
      <div
        className="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg pointer-events-none"
        style={{
          left: hoverPos.x + 12,
          top: hoverPos.y - 28,
        }}
      >
        {label}{cap}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
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
        style={{ backgroundColor: '#F8F9FB' }}
      >
        {/* Shared SVG defs (patterns, filters) */}
        <SVG_DEFS />

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
            rx={2}
          />

          {/* Dot grid */}
          {renderGrid()}

          {/* Objects */}
          {objects
            .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
            .map(renderObject)}
        </g>
      </svg>

      {/* Hover tooltip (DOM overlay) */}
      {renderTooltip()}
    </div>
  );
});

EditorCanvas.displayName = 'EditorCanvas';
