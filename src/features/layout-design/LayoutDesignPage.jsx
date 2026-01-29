/**
 * Layout Design Page
 * Main entry point for the layout editor feature
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useLayout, useTemplates } from './hooks/useLayout';
import { useAutosave } from './hooks/useAutosave';
import { useLayoutStore } from './stores/layoutStore';
import { LayoutEditor } from './components/Editor/LayoutEditor';
import { Preview3D } from './components/Preview3D/Preview3D';
import { TemplateGallery } from './components/TemplateGallery/TemplateGallery';

export function LayoutDesignPage() {
  const { layoutId } = useParams();
  const navigate = useNavigate();
  const { layout, isLoading, activeView } = useLayoutStore();

  // Load templates
  useTemplates();

  // Load layout data
  useLayout(layoutId);

  // Enable autosave
  useAutosave();

  // Show loading
  if (isLoading && layoutId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2969FF] mx-auto mb-4" />
          <p className="text-gray-600">Loading layout...</p>
        </div>
      </div>
    );
  }

  // Show template gallery if no layout
  if (!layoutId) {
    return (
      <TemplateGallery
        onSelect={(newLayout) => {
          navigate(`/organizer/layout-design/${newLayout.id}`);
        }}
      />
    );
  }

  // Show editor or 3D preview
  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {activeView === '2d' ? <LayoutEditor /> : <Preview3D />}
    </div>
  );
}
