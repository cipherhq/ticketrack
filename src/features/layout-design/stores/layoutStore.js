/**
 * Layout Design Zustand Store
 * Manages all state for the layout editor
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useLayoutStore = create(
  immer((set, get) => ({
    // === LAYOUT DATA ===
    layout: null,
    objects: [],
    seats: [],
    templates: [],
    isLoading: true,
    isSaving: false,
    lastSaved: null,
    isDirty: false,

    // === CANVAS STATE ===
    canvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
      gridSize: 20,
      gridVisible: true,
      snapToGrid: true,
    },

    // === SELECTION ===
    selectedIds: [],
    hoveredId: null,

    // === UI STATE ===
    activeView: '2d', // '2d' | '3d'
    activeTool: 'select', // 'select' | 'pan' | object type
    showLayers: false,
    showValidation: false,
    sidePanel: 'properties', // 'properties' | 'layers' | null

    // === HISTORY ===
    history: [],
    historyIndex: -1,
    maxHistory: 50,

    // === VALIDATION ===
    validationResults: { errors: [], warnings: [], info: [] },

    // === ACTIONS: Layout ===
    setLayout: (layout) => set({ layout, isLoading: false }),

    setTemplates: (templates) => set({ templates }),

    setObjects: (objects) => set((state) => {
      state.objects = objects;
    }),

    setSeats: (seats) => set((state) => {
      state.seats = seats;
    }),

    setLoading: (isLoading) => set({ isLoading }),

    // === ACTIONS: Objects CRUD ===
    addObject: (object) => set((state) => {
      const newObject = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        z_index: state.objects.length,
        ...object,
      };
      state.objects.push(newObject);
      state.selectedIds = [newObject.id];
      state.isDirty = true;
    }),

    updateObject: (id, updates) => set((state) => {
      const index = state.objects.findIndex((o) => o.id === id);
      if (index !== -1) {
        state.objects[index] = { ...state.objects[index], ...updates };
        state.isDirty = true;
      }
    }),

    updateObjects: (updates) => set((state) => {
      updates.forEach(({ id, ...changes }) => {
        const index = state.objects.findIndex((o) => o.id === id);
        if (index !== -1) {
          state.objects[index] = { ...state.objects[index], ...changes };
        }
      });
      state.isDirty = true;
    }),

    deleteObject: (id) => set((state) => {
      state.objects = state.objects.filter((o) => o.id !== id);
      state.seats = state.seats.filter((s) => s.parent_object_id !== id);
      state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
      state.isDirty = true;
    }),

    deleteSelected: () => set((state) => {
      const ids = state.selectedIds;
      state.objects = state.objects.filter((o) => !ids.includes(o.id));
      state.seats = state.seats.filter((s) => !ids.includes(s.parent_object_id));
      state.selectedIds = [];
      state.isDirty = true;
    }),

    duplicateSelected: () => set((state) => {
      const newObjects = state.selectedIds
        .map((id) => {
          const original = state.objects.find((o) => o.id === id);
          if (!original) return null;
          return {
            ...original,
            id: crypto.randomUUID(),
            x: original.x + 20,
            y: original.y + 20,
            name: `${original.name || 'Object'} (copy)`,
          };
        })
        .filter(Boolean);

      state.objects.push(...newObjects);
      state.selectedIds = newObjects.map((o) => o.id);
      state.isDirty = true;
    }),

    // === ACTIONS: Selection ===
    select: (id) => set({ selectedIds: [id] }),

    addToSelection: (id) => set((state) => {
      if (!state.selectedIds.includes(id)) {
        state.selectedIds.push(id);
      }
    }),

    toggleSelection: (id) => set((state) => {
      const index = state.selectedIds.indexOf(id);
      if (index === -1) {
        state.selectedIds.push(id);
      } else {
        state.selectedIds.splice(index, 1);
      }
    }),

    selectAll: () => set((state) => {
      state.selectedIds = state.objects.map((o) => o.id);
    }),

    clearSelection: () => set({ selectedIds: [] }),

    setHovered: (id) => set({ hoveredId: id }),

    // === ACTIONS: Canvas ===
    setZoom: (zoom) => set((state) => {
      state.canvas.zoom = Math.max(0.1, Math.min(3, zoom));
    }),

    setPan: (x, y) => set((state) => {
      state.canvas.panX = x;
      state.canvas.panY = y;
    }),

    toggleGrid: () => set((state) => {
      state.canvas.gridVisible = !state.canvas.gridVisible;
    }),

    toggleSnap: () => set((state) => {
      state.canvas.snapToGrid = !state.canvas.snapToGrid;
    }),

    setGridSize: (size) => set((state) => {
      state.canvas.gridSize = size;
    }),

    resetView: () => set((state) => {
      state.canvas.zoom = 1;
      state.canvas.panX = 0;
      state.canvas.panY = 0;
    }),

    // === ACTIONS: View ===
    setActiveView: (view) => set({ activeView: view }),
    setActiveTool: (tool) => set({ activeTool: tool }),
    toggleLayers: () => set((state) => {
      state.showLayers = !state.showLayers;
    }),
    toggleValidation: () => set((state) => {
      state.showValidation = !state.showValidation;
    }),
    setSidePanel: (panel) => set({ sidePanel: panel }),

    // === ACTIONS: History ===
    pushHistory: () => set((state) => {
      const snapshot = JSON.stringify({
        objects: state.objects,
        seats: state.seats,
      });

      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(snapshot);
      if (state.history.length > state.maxHistory) {
        state.history.shift();
      }
      state.historyIndex = state.history.length - 1;
    }),

    undo: () => set((state) => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        const snapshot = JSON.parse(state.history[state.historyIndex]);
        state.objects = snapshot.objects;
        state.seats = snapshot.seats;
        state.isDirty = true;
      }
    }),

    redo: () => set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const snapshot = JSON.parse(state.history[state.historyIndex]);
        state.objects = snapshot.objects;
        state.seats = snapshot.seats;
        state.isDirty = true;
      }
    }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // === ACTIONS: Validation ===
    setValidationResults: (results) => set({ validationResults: results }),

    // === ACTIONS: Save State ===
    setSaving: (isSaving) => set({ isSaving }),
    setDirty: (isDirty) => set({ isDirty }),
    setSaved: () => set({ lastSaved: new Date(), isDirty: false, isSaving: false }),

    // === SELECTORS ===
    getSelectedObjects: () => {
      const { objects, selectedIds } = get();
      return objects.filter((o) => selectedIds.includes(o.id));
    },

    getObjectById: (id) => {
      return get().objects.find((o) => o.id === id);
    },

    getSeatsByParent: (parentId) => {
      return get().seats.filter((s) => s.parent_object_id === parentId);
    },

    getTotalCapacity: () => {
      return get().objects.reduce((sum, obj) => sum + (obj.capacity || 0), 0);
    },
  }))
);
