/**
 * Template Gallery
 * Select a template to create a new layout
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Layout, Users, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLayoutStore } from '../../stores/layoutStore';
import { createLayout } from '../../hooks/useLayout';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { toast } from 'sonner';

export function TemplateGallery({ onSelect }) {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const { templates } = useLayoutStore();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [layoutName, setLayoutName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setLayoutName(template ? `${template.name} Layout` : 'My Layout');
    setShowNameDialog(true);
  };

  const handleCreateLayout = async () => {
    if (!layoutName.trim()) {
      toast.error('Please enter a layout name');
      return;
    }

    if (!organizer?.id) {
      toast.error('Please log in as an organizer');
      return;
    }

    setIsCreating(true);

    try {
      const templateData = selectedTemplate?.template_data || null;
      const layout = await createLayout(organizer.id, layoutName.trim(), templateData);
      toast.success('Layout created!');
      onSelect(layout);
    } catch (error) {
      // Error handled in createLayout
    } finally {
      setIsCreating(false);
      setShowNameDialog(false);
    }
  };

  const defaultTemplates = [
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start with an empty layout',
      category: 'blank',
      capacity_estimate: 0,
      template_data: { canvas_width: 800, canvas_height: 600, objects: [] },
    },
    ...templates,
  ];

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'concert':
        return '🎤';
      case 'theater':
        return '🎭';
      case 'conference':
        return '🎯';
      case 'banquet':
        return '🍽️';
      case 'blank':
        return '📐';
      default:
        return '📍';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/organizer/venues')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Venues
          </Button>

          <h1 className="text-3xl font-bold text-foreground">Layout Design</h1>
          <p className="text-muted-foreground mt-2">
            Choose a template to get started or create a blank layout
          </p>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {defaultTemplates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-[#2969FF]"
              onClick={() => handleSelectTemplate(template)}
            >
              <CardContent className="p-6">
                <div className="text-4xl mb-4">
                  {getCategoryIcon(template.category)}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description}
                </p>
                {template.capacity_estimate > 0 && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-1" />
                    ~{template.capacity_estimate} capacity
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            How Layout Design Works
          </h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Drag and drop objects like stages, seating sections, and markers</li>
            <li>• Set capacity and ticket types for each section</li>
            <li>• Preview your layout in 3D before publishing</li>
            <li>• Export to PDF for printing or sharing</li>
          </ul>
        </div>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="layoutName">Layout Name</Label>
              <Input
                id="layoutName"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Enter a name for your layout"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNameDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateLayout} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Layout
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
