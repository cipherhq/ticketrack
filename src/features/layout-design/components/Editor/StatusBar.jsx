/**
 * Status Bar
 * Bottom bar showing canvas info and stats
 */

import { useLayoutStore } from '../../stores/layoutStore';

export function StatusBar() {
  const { objects, selectedIds, canvas, layout } = useLayoutStore();

  const totalCapacity = objects.reduce((sum, obj) => sum + (obj.capacity || 0), 0);
  const entrances = objects.filter((o) => o.object_type === 'entrance').length;
  const exits = objects.filter((o) => o.object_type === 'exit').length;

  return (
    <div className="h-8 bg-white border-t border-gray-200 flex items-center px-4 text-xs text-gray-600">
      <div className="flex items-center gap-4">
        <span>
          Zoom: <strong>{Math.round(canvas.zoom * 100)}%</strong>
        </span>
        <span>
          Grid: <strong>{canvas.gridSize}px</strong>
        </span>
        <span>
          Selected: <strong>{selectedIds.length}</strong>
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <span>
          Objects: <strong>{objects.length}</strong>
        </span>
        <span>
          Capacity: <strong>{totalCapacity}</strong>
        </span>
        <span className={entrances === 0 ? 'text-red-500' : ''}>
          Entrances: <strong>{entrances}</strong>
        </span>
        <span className={exits === 0 ? 'text-red-500' : ''}>
          Exits: <strong>{exits}</strong>
        </span>
        <span>
          Canvas: <strong>{layout?.canvas_width || 800} × {layout?.canvas_height || 600}</strong>
        </span>
      </div>
    </div>
  );
}
