/**
 * Autosave hook for layout changes
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLayoutStore } from '../stores/layoutStore';
import { toast } from 'sonner';

export function useAutosave() {
  const {
    layout,
    objects,
    seats,
    isDirty,
    setSaving,
    setSaved,
  } = useLayoutStore();

  const timeoutRef = useRef(null);

  const save = useCallback(async () => {
    if (!layout?.id || !isDirty) return;

    setSaving(true);

    try {
      // Get existing object IDs
      const { data: existingObjects } = await supabase
        .from('layout_objects')
        .select('id')
        .eq('layout_id', layout.id);

      const existingIds = new Set((existingObjects || []).map((o) => o.id));
      const currentIds = new Set(objects.map((o) => o.id));

      // Find objects to delete
      const toDelete = [...existingIds].filter((id) => !currentIds.has(id));

      // Delete removed objects
      if (toDelete.length > 0) {
        await supabase
          .from('layout_objects')
          .delete()
          .in('id', toDelete);
      }

      // Upsert current objects
      if (objects.length > 0) {
        const objectsToSave = objects.map((obj) => ({
          ...obj,
          layout_id: layout.id,
          updated_at: new Date().toISOString(),
        }));

        const { error: objError } = await supabase
          .from('layout_objects')
          .upsert(objectsToSave, { onConflict: 'id' });

        if (objError) throw objError;
      }

      // Update layout metadata
      const totalCapacity = objects.reduce((sum, obj) => sum + (obj.capacity || 0), 0);

      await supabase
        .from('layouts')
        .update({
          total_capacity: totalCapacity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', layout.id);

      setSaved();
    } catch (error) {
      console.error('Autosave failed:', error);
      toast.error('Failed to save changes');
      setSaving(false);
    }
  }, [layout?.id, objects, seats, isDirty]);

  // Debounced autosave
  useEffect(() => {
    if (isDirty) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        save();
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isDirty, save]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty) {
        save();
      }
    };
  }, []);

  return { save };
}
