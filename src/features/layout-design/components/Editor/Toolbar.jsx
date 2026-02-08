/**
 * Editor Toolbar
 * Top toolbar with actions and view controls
 */

import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  Box,
  Download,
  Printer,
  Check,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayoutStore } from '../../stores/layoutStore';
import { ExportDialog } from '../Export/ExportDialog';
import { useState } from 'react';

export function Toolbar({ canvasRef }) {
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);

  const {
    layout,
    canvas,
    isSaving,
    lastSaved,
    isDirty,
    activeView,
    setZoom,
    toggleGrid,
    toggleSnap,
    resetView,
    setActiveView,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useLayoutStore();

  const formatLastSaved = () => {
    if (!lastSaved) return 'Not saved';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved ${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <TooltipProvider>
      <div className="h-14 bg-card border-b border-border/20 flex items-center px-4 gap-2">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/organizer/venues')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Layout Name */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className="font-medium text-foreground truncate">
            {layout?.name || 'Untitled Layout'}
          </span>
          <span className="text-xs text-muted-foreground flex items-center">
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : isDirty ? (
              'Unsaved changes'
            ) : (
              <>
                <Check className="w-3 h-3 mr-1 text-green-500" />
                {formatLastSaved()}
              </>
            )}
          </span>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => undo()}
                disabled={!canUndo()}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redo()}
                disabled={!canRedo()}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(canvas.zoom - 0.1)}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            className="min-w-[60px]"
            onClick={resetView}
          >
            {Math.round(canvas.zoom * 100)}%
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(canvas.zoom + 0.1)}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Grid & Snap */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={canvas.gridVisible ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleGrid}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={canvas.snapToGrid ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleSnap}
              >
                <Magnet className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snap to Grid</TooltipContent>
          </Tooltip>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeView === '3d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView(activeView === '2d' ? '3d' : '2d')}
              >
                <Box className="w-4 h-4 mr-2" />
                3D Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle 3D Preview</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Export Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Export Dialog */}
        <ExportDialog
          open={showExport}
          onOpenChange={setShowExport}
          canvasRef={canvasRef}
        />
      </div>
    </TooltipProvider>
  );
}
