/**
 * Hook for loading and managing layout data
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLayoutStore } from '../stores/layoutStore';
import { toast } from 'sonner';

export function useLayout(layoutId) {
  const {
    setLayout,
    setObjects,
    setSeats,
    setLoading,
    pushHistory,
  } = useLayoutStore();

  const loadLayout = useCallback(async () => {
    if (!layoutId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: layout, error } = await supabase
        .from('layouts')
        .select(`
          *,
          layout_objects (*),
          layout_seats (*)
        `)
        .eq('id', layoutId)
        .single();

      if (error) throw error;

      setLayout(layout);
      setObjects(layout.layout_objects || []);
      setSeats(layout.layout_seats || []);
      pushHistory();
    } catch (error) {
      console.error('Failed to load layout:', error);
      toast.error('Failed to load layout');
      setLoading(false);
    }
  }, [layoutId]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  return { reload: loadLayout };
}

export function useTemplates() {
  const { setTemplates } = useLayoutStore();

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('layout_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };

    loadTemplates();
  }, []);
}

export async function createLayout(organizerId, name, templateData = null) {
  try {
    const layoutData = {
      organizer_id: organizerId,
      name,
      canvas_width: templateData?.canvas_width || 800,
      canvas_height: templateData?.canvas_height || 600,
      status: 'draft',
    };

    const { data: layout, error: layoutError } = await supabase
      .from('layouts')
      .insert(layoutData)
      .select()
      .single();

    if (layoutError) throw layoutError;

    // If template has objects, create them
    if (templateData?.objects?.length > 0) {
      const objects = templateData.objects.map((obj) => ({
        ...obj,
        id: crypto.randomUUID(),
        layout_id: layout.id,
      }));

      const { error: objectsError } = await supabase
        .from('layout_objects')
        .insert(objects);

      if (objectsError) throw objectsError;
    }

    return layout;
  } catch (error) {
    console.error('Failed to create layout:', error);
    toast.error('Failed to create layout');
    throw error;
  }
}

export async function deleteLayout(layoutId) {
  try {
    // Delete seats first
    await supabase
      .from('layout_seats')
      .delete()
      .eq('layout_id', layoutId);

    // Delete objects
    await supabase
      .from('layout_objects')
      .delete()
      .eq('layout_id', layoutId);

    // Delete versions
    await supabase
      .from('layout_versions')
      .delete()
      .eq('layout_id', layoutId);

    // Delete layout
    const { error } = await supabase
      .from('layouts')
      .delete()
      .eq('id', layoutId);

    if (error) throw error;

    toast.success('Layout deleted');
  } catch (error) {
    console.error('Failed to delete layout:', error);
    toast.error('Failed to delete layout');
    throw error;
  }
}
