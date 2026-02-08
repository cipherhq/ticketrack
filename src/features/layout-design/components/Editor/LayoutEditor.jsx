/**
 * Layout Editor
 * Main 2D editing interface
 */

import { useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { ObjectPalette } from './ObjectPalette';
import { EditorCanvas } from './EditorCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { useLayoutStore } from '../../stores/layoutStore';

export function LayoutEditor() {
  const canvasRef = useRef();
  const containerRef = useRef();
  const { clearSelection, deleteSelected, duplicateSelected, selectAll, undo, redo } = useLayoutStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }

      // Ctrl/Cmd + Z - Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Shift + Z - Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      // Ctrl/Cmd + Y - Redo (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }

      // Ctrl/Cmd + D - Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }

      // Ctrl/Cmd + A - Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      {/* Top Toolbar */}
      <Toolbar canvasRef={canvasRef} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Object Palette */}
        <ObjectPalette />

        {/* Center: Canvas */}
        <div className="flex-1 relative overflow-hidden bg-muted">
          <EditorCanvas ref={canvasRef} />
        </div>

        {/* Right: Properties Panel */}
        <PropertiesPanel />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar />
    </div>
  );
}
