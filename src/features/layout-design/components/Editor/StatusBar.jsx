/**
 * Status Bar
 * Bottom bar showing canvas info and stats with icons and polish.
 */

import { ZoomIn, Grid3X3, MousePointer2, Box, Users, DoorOpen, DoorClosed, Maximize } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';

export function StatusBar() {
  const { objects, selectedIds, canvas, layout } = useLayoutStore();

  const totalCapacity = objects.reduce((sum, obj) => sum + (obj.capacity || 0), 0);
  const entrances = objects.filter((o) => o.object_type === 'entrance').length;
  const exits = objects.filter((o) => o.object_type === 'exit').length;
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="h-8 bg-card border-t border-border/20 flex items-center px-4 text-xs text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <ZoomIn className="w-3 h-3" />
          <strong>{Math.round(canvas.zoom * 100)}%</strong>
        </span>
        <span className="flex items-center gap-1">
          <Grid3X3 className="w-3 h-3" />
          <strong>{canvas.gridSize}px</strong>
        </span>
        <span className={`flex items-center gap-1 ${hasSelection ? 'text-blue-600' : ''}`}>
          <MousePointer2 className="w-3 h-3" />
          <strong>{selectedIds.length}</strong> selected
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Box className="w-3 h-3" />
          <strong>{objects.length}</strong> object{objects.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <strong>{totalCapacity}</strong> cap
        </span>
        <span className={`flex items-center gap-1 ${entrances === 0 ? 'text-red-500' : ''}`}>
          <DoorOpen className="w-3 h-3" />
          <strong>{entrances}</strong> entrance{entrances !== 1 ? 's' : ''}
        </span>
        <span className={`flex items-center gap-1 ${exits === 0 ? 'text-red-500' : ''}`}>
          <DoorClosed className="w-3 h-3" />
          <strong>{exits}</strong> exit{exits !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Maximize className="w-3 h-3" />
          <strong>{layout?.canvas_width || 800} × {layout?.canvas_height || 600}</strong>
        </span>
      </div>
    </div>
  );
}
