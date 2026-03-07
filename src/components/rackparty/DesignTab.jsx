import { useState, useRef, useEffect } from 'react';
import { Loader2, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { updateInviteDesign, logActivity } from '@/services/partyInvites';
import {
  PARTY_TEMPLATES, ACCENT_COLORS, FONT_OPTIONS, BACKGROUND_PATTERNS,
  EXPORT_SIZES, getFavorites, loadGoogleFont,
  TemplatePreview, TemplateControls,
} from './shared';

export function DesignTab({ invite, organizer, onInviteUpdate }) {
  const dm = invite.design_metadata || {};

  const [selectedTemplate, setSelectedTemplate] = useState(dm.templateId || null);
  const [selectedColor, setSelectedColor] = useState(dm.accentColor || ACCENT_COLORS[0].value);
  const [textOverride, setTextOverride] = useState(dm.textOverride || null);
  const [selectedFont, setSelectedFont] = useState(dm.fontId || 'bold-modern');
  const [fontScale, setFontScale] = useState(dm.fontScale || 1);
  const [tagline, setTagline] = useState(dm.tagline || '');
  const [selectedPattern, setSelectedPattern] = useState(dm.backgroundPattern || 'none');
  const [favorites, setFavorites] = useState(getFavorites());
  const [saving, setSaving] = useState(false);
  const [generatingExport, setGeneratingExport] = useState(false);

  const previewRef = useRef(null);
  const exportRef = useRef(null);
  const [exportSize, setExportSize] = useState(EXPORT_SIZES[0]);

  const activeTemplate = PARTY_TEMPLATES.find(t => t.id === selectedTemplate);
  const activeFontObj = FONT_OPTIONS.find(f => f.id === selectedFont) || FONT_OPTIONS[0];

  useEffect(() => {
    if (activeFontObj.google) loadGoogleFont(activeFontObj.google);
  }, [activeFontObj]);

  const templatePreviewProps = {
    template: activeTemplate,
    accentColor: selectedColor,
    partyName: invite.title,
    startDate: invite.start_date,
    venueName: invite.venue_name,
    textColorOverride: textOverride,
    fontFamily: activeFontObj.family,
    fontWeight: activeFontObj.weight,
    fontScale,
    tagline,
    backgroundPattern: selectedPattern,
  };

  async function handleSaveDesign() {
    if (!activeTemplate) {
      toast.error('Select a template first');
      return;
    }
    setSaving(true);
    try {
      const designMetadata = {
        templateId: selectedTemplate,
        accentColor: selectedColor,
        textOverride,
        fontId: selectedFont,
        fontScale,
        tagline,
        backgroundPattern: selectedPattern,
      };

      // Generate cover image from template
      if (activeFontObj.google) loadGoogleFont(activeFontObj.google);
      await document.fonts.ready;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, useCORS: true, backgroundColor: null, width: 600, height: 800,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'party-cover.png', { type: 'image/png' });

      // Upload to storage
      const path = `party-invites/${organizer.id}/${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from('event-images').upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);

      // Update invite with design metadata + new cover image
      const updated = await updateInviteDesign(invite.id, designMetadata);

      // Also update cover_image_url
      const { data: finalInvite, error: coverErr } = await supabase
        .from('party_invites')
        .update({ cover_image_url: publicUrl })
        .eq('id', invite.id)
        .select()
        .single();

      if (coverErr) throw coverErr;

      await logActivity(invite.id, 'design_updated', organizer?.business_name || 'Host');
      onInviteUpdate(finalInvite);
      toast.success('Design saved!');
    } catch (err) {
      console.error('Save design error:', err);
      toast.error('Failed to save design');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportSize(size) {
    if (!activeTemplate) return;
    setGeneratingExport(true);
    try {
      if (activeFontObj.google) loadGoogleFont(activeFontObj.google);
      await document.fonts.ready;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
        scale: 1, useCORS: true, backgroundColor: null, width: size.w, height: size.h,
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `party-${size.w}x${size.h}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image exported!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export image');
    } finally {
      setGeneratingExport(false);
    }
  }

  return (
    <div className="space-y-6">
      <TemplateControls
        activeTemplate={activeTemplate}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        textOverride={textOverride}
        setTextOverride={setTextOverride}
        selectedFont={selectedFont}
        setSelectedFont={setSelectedFont}
        fontScale={fontScale}
        setFontScale={setFontScale}
        tagline={tagline}
        setTagline={setTagline}
        selectedPattern={selectedPattern}
        setSelectedPattern={setSelectedPattern}
        favorites={favorites}
        setFavorites={setFavorites}
        setSelectedTemplate={setSelectedTemplate}
      />

      {activeTemplate && (
        <>
          <div className="flex justify-center">
            <div className="shadow-xl rounded-2xl overflow-hidden">
              <TemplatePreview {...templatePreviewProps} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSaveDesign}
              disabled={saving}
              className="rounded-xl gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Design
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Export for Social Media</p>
            <div className="flex flex-wrap gap-2">
              {EXPORT_SIZES.map(size => (
                <Button
                  key={size.label}
                  variant="outline"
                  size="sm"
                  onClick={() => { setExportSize(size); setTimeout(() => handleExportSize(size), 100); }}
                  disabled={generatingExport}
                  className="rounded-lg gap-1.5 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> {size.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Hidden capture elements */}
      {activeTemplate && (
        <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
          <div ref={previewRef}>
            <TemplatePreview {...templatePreviewProps} forCapture />
          </div>
          <div ref={exportRef}>
            <TemplatePreview {...templatePreviewProps} forCapture captureWidth={exportSize.w} captureHeight={exportSize.h} />
          </div>
        </div>
      )}
    </div>
  );
}
