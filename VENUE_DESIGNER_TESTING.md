# Venue Layout Designer - Testing Guide

## 🎯 Where to Access

**URL Path:** `/organizer/venues/[venueId]/layouts/[layoutId]` or `/organizer/venues/[venueId]/layouts/create`

**Navigation:**
1. Login as an Organizer
2. Go to **Organizer Dashboard** → **Venues**
3. Click on a venue (or create a new one)
4. Click **"Create Layout"** or edit an existing layout

---

## ✅ Testing Checklist

### 1. **Page Load & Initial Setup**
- [ ] Page loads without errors (check browser console)
- [ ] Canvas displays with grid (if enabled)
- [ ] Left panel (Object Library) is visible
- [ ] Right panel (Properties) is visible
- [ ] Top toolbar with Save button is visible
- [ ] Status bar at bottom shows "0 objects"

**Test:** Navigate to `/organizer/venues/[venueId]/layouts/create`

---

### 2. **Object Library (Left Panel)**

#### 2.1 Categories
- [ ] Click each category to expand/collapse:
  - Event Essentials
  - Tables & Seating
  - Stage & Performance
  - Food & Beverage
  - Photo & Media
  - A/V & Tech
  - Lounge & VIP
  - Decor & Barriers
  - Outdoor & Tents

#### 2.2 Add Objects
- [ ] **Click Method:** Click any object in the library → should appear in center of canvas
- [ ] **Drag & Drop Method:** Drag an object from library → drop on canvas → should appear where dropped
- [ ] Objects should look realistic (chairs look like chairs, tables have legs, etc.)

#### 2.3 Search
- [ ] Type in search box → objects filter correctly
- [ ] Clear search → all objects show again

**Test Objects to Add:**
- Round Table (8-Top) → should show table with chairs around it
- Check-in Desk → should show desk with counter
- Exit → should show red door with arrow
- Security Post → should show post with shield icon
- DJ Booth → should show turntables and mixer
- Stage → should show platform with supports
- Bar → should show counter with stools
- Photo Booth → should show camera with flash
- VIP Section → should show purple area

---

### 3. **Object Manipulation**

#### 3.1 Selection
- [ ] Click an object → should highlight with blue dashed border
- [ ] Click empty space → selection clears
- [ ] Shift+Click multiple objects → all selected
- [ ] Ctrl+A (Cmd+A on Mac) → select all objects

#### 3.2 Move Objects
- [ ] Click and drag an object → should move smoothly
- [ ] Object snaps to grid (if enabled)
- [ ] Drag multiple selected objects → all move together

#### 3.3 Delete Objects
- [ ] Select an object → Press Delete or Backspace → object removed
- [ ] Select multiple → Delete → all removed
- [ ] Undo (Ctrl+Z) → deleted object returns

#### 3.4 Duplicate Objects
- [ ] Select object → Ctrl+D (Cmd+D) → duplicate appears
- [ ] Duplicate button in properties panel → also works

---

### 4. **Properties Panel (Right Side)**

#### 4.1 Object Properties
- [ ] Select an object → properties panel shows:
  - Type
  - Label (text input)
  - Color (color picker + hex input)
  - Width/Depth (in feet)
  - Rotation (number input + rotate button)

#### 4.2 Table-Specific Properties
- [ ] Select a round table → shows:
  - Table Number
  - Seats (number)
  - Changing seats → chairs around table update

#### 4.3 Edit Properties
- [ ] Change Label → text appears on object
- [ ] Change Color → object color updates
- [ ] Change Width/Depth → object resizes
- [ ] Change Rotation → object rotates (or click rotate button)
- [ ] Change Table Number → number appears on table

---

### 5. **Canvas Controls**

#### 5.1 Grid
- [ ] Click Grid icon → grid toggles on/off
- [ ] Grid should show when enabled

#### 5.2 Snap to Grid
- [ ] When enabled → objects snap to grid positions
- [ ] When disabled → objects can be placed freely

#### 5.3 Zoom
- [ ] Zoom In (+ or button) → canvas zooms in (max 150%)
- [ ] Zoom Out (- or button) → canvas zooms out (min 25%)
- [ ] Zoom percentage displays in toolbar

#### 5.4 Canvas Size
- [ ] In properties panel bottom → change Canvas Width/Height
- [ ] Canvas resizes (values in feet, internally converted to pixels)

---

### 6. **Keyboard Shortcuts**

Test each shortcut:
- [ ] **Delete/Backspace** → Delete selected object(s)
- [ ] **Ctrl+D (Cmd+D)** → Duplicate selected
- [ ] **Ctrl+Z (Cmd+Z)** → Undo
- [ ] **Ctrl+Shift+Z (Cmd+Shift+Z)** → Redo
- [ ] **Ctrl+A (Cmd+A)** → Select all objects
- [ ] **Ctrl+S (Cmd+S)** → Save layout
- [ ] **Escape** → Clear selection
- [ ] **+** → Zoom in
- [ ] **-** → Zoom out

---

### 7. **Save Functionality** ⭐ CRITICAL

#### 7.1 Save New Layout
- [ ] Add several objects to canvas
- [ ] Enter layout name (e.g., "Test Layout")
- [ ] Click **Save** button
- [ ] Button shows "Saving..." → then "✓ Saved!" (green)
- [ ] Status bar shows "Last saved: [time]"
- [ ] URL updates to include layout ID
- [ ] Refresh page → layout loads with all objects intact

#### 7.2 Update Existing Layout
- [ ] Load an existing layout
- [ ] Add/modify/delete objects
- [ ] Change layout name
- [ ] Click **Save**
- [ ] Should show "✓ Saved!" success message
- [ ] Refresh → changes persist

#### 7.3 Save with Keyboard
- [ ] Make changes
- [ ] Press **Ctrl+S (Cmd+S)**
- [ ] Should save and show success feedback

#### 7.4 Error Handling
- [ ] Try saving without organizer ID → should show error
- [ ] Try saving with invalid venue ID → should show error
- [ ] Error button should turn red

**Verify in Database:**
- Check `venue_layouts` table:
  - `name` should match
  - `total_width` and `total_height` should be in feet
  - `metadata` JSONB should contain:
    ```json
    {
      "objects": [...],
      "gridSize": 24,
      "showGrid": true,
      "zoom": 80,
      "snapToGrid": true
    }
    ```

---

### 8. **Visual Object Realism**

Check that objects look realistic:

- [ ] **Chairs** → Seat, backrest, legs visible
- [ ] **Tables** → Table top with base/legs
- [ ] **Security Posts** → Post with sign and shield icon
- [ ] **Check-in Desks** → Counter surface with multiple levels
- [ ] **Exit/Entrance** → Directional arrows visible
- [ ] **Stages** → Platform with front edge and supports
- [ ] **DJ Booths** → Turntables and mixer visible
- [ ] **Bars** → Counter with bar stools in front
- [ ] **Buffets** → Counter with serving dishes
- [ ] **Photo Booths** → Camera with flash unit
- [ ] **Dance Floors** → Checkerboard tile pattern
- [ ] **Plants** → Pot with green leaves
- [ ] **Sofas** → Cushions, backrest, armrests

---

### 9. **Performance**

#### 9.1 Smooth Interactions
- [ ] Dragging objects should be smooth (no lag)
- [ ] No stuttering when moving multiple objects
- [ ] Zoom should be responsive
- [ ] Adding many objects (20+) → still performs well

#### 9.2 Large Layouts
- [ ] Create layout with 30+ objects
- [ ] All objects render correctly
- [ ] Selection and dragging still work smoothly
- [ ] Save and load still work

---

### 10. **Panel Controls**

#### 10.1 Left Panel (Object Library)
- [ ] Click collapse button (<<) → panel collapses to icon
- [ ] Click expand icon (>) → panel expands
- [ ] Objects still accessible when collapsed (via drag)

#### 10.2 Right Panel (Properties)
- [ ] Click collapse button (>>) → panel collapses
- [ ] Click expand icon (<) → panel expands
- [ ] Properties still editable when collapsed (via selection)

---

### 11. **Round Table Chairs**

Special feature to test:
- [ ] Add "8-Top Round" table
- [ ] Change "Seats" to 10 → chairs update around table
- [ ] Change to 6 → chairs reduce
- [ ] Chairs should be evenly spaced around table

---

### 12. **Status Bar**

Check bottom status bar shows:
- [ ] Object count (e.g., "5 objects")
- [ ] Selected count (e.g., "2 selected")
- [ ] Canvas size (e.g., "100×67 ft")
- [ ] Snap status (e.g., "Snap: On")
- [ ] Last saved time (after saving)

---

## 🐛 Known Issues to Watch For

1. **Save Errors**
   - If save fails → check console for error message
   - Verify organizer is logged in
   - Verify venue_id exists

2. **Object Not Loading**
   - Check if objects array is empty
   - Verify metadata structure in database

3. **Performance**
   - If laggy with many objects → check browser console
   - Try reducing zoom level

---

## 📝 Test Scenarios

### Scenario 1: Create Wedding Reception Layout
1. Create new layout named "Wedding Reception"
2. Add:
   - Stage (Large) at top
   - Dance Floor (Large) in center
   - 8x10-Top Round tables around dance floor (10 tables)
   - 2x Bar (Straight) on sides
   - 1x Buffet Line
   - Check-in Desk at entrance
   - Exit signs at exits
3. Label tables with numbers (1-10)
4. Set VIP table to different color
5. Save layout
6. Reload page → verify everything loads correctly

### Scenario 2: Edit Existing Layout
1. Load an existing layout
2. Move 3 objects to new positions
3. Delete 2 objects
4. Add 5 new objects
5. Change layout name
6. Save
7. Verify all changes persisted

### Scenario 3: Test All Object Types
1. Add one object from each category:
   - Event Essentials: Check-in, Exit, Security
   - Tables: Round table, Rectangle table, Cocktail table
   - Stage: Stage, DJ Booth, Dance Floor
   - Food: Bar, Buffet, Dessert table
   - Photo: Photo Booth, Step & Repeat
   - A/V: Screen, Speaker, Podium
   - Lounge: Sofa, Armchair, Coffee table
   - Decor: Plant, Stanchion, Barrier
   - Outdoor: Tent, Umbrella
2. Verify each looks realistic
3. Save and reload

---

## ✅ Success Criteria

All tests pass if:
- ✅ Page loads without errors
- ✅ Objects add/remove/move smoothly
- ✅ Objects look realistic (not just colored shapes)
- ✅ Save works (both new and updates)
- ✅ Layout loads correctly after save
- ✅ All keyboard shortcuts work
- ✅ Properties panel edits work
- ✅ No performance lag with 20+ objects

---

## 🔍 Debugging Tips

If something doesn't work:
1. **Open Browser Console** (F12 → Console tab)
2. Check for error messages
3. **Check Network Tab** → Look for failed API calls
4. **Check Database** → Verify data structure matches schema
5. **Clear Browser Cache** → Refresh page
6. **Check Organizer Context** → Ensure logged in as organizer

---

## 📊 Expected Database State After Save

```sql
SELECT 
  id,
  name,
  total_width,  -- in feet (e.g., 100.00)
  total_height, -- in feet (e.g., 67.00)
  grid_size,    -- in feet (e.g., 2.00)
  metadata->'objects' as object_count,
  updated_at
FROM venue_layouts 
WHERE id = '[your-layout-id]';
```

Metadata should contain:
```json
{
  "objects": [
    {
      "id": "obj-...",
      "type": "round-table",
      "name": "8-Top Round",
      "x": 600,
      "y": 400,
      "width": 72,
      "height": 72,
      "color": "#E91E63",
      "seats": 8,
      "rotation": 0,
      ...
    }
  ],
  "gridSize": 24,
  "showGrid": true,
  "zoom": 80,
  "snapToGrid": true
}
```

---

**Happy Testing! 🎉**
