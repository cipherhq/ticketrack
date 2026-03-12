import { useState, useEffect } from 'react';
import { Loader2, Camera, Trash2, Heart, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { validateImageUpload, safeImageExt } from '@/lib/utils';
import { getInvitePhotos, uploadPartyPhoto, deletePartyPhoto, likePhoto, unlikePhoto } from '@/services/partyInvites';
import { compressImage } from '@/lib/imageCompression';
import { formatDistanceToNow } from 'date-fns';

export function PhotosTab({ invite, organizer }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  useEffect(() => {
    loadPhotos();
  }, [invite.id]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const data = await getInvitePhotos(invite.id);
      setPhotos(data);
    } catch (err) {
      console.error('Error loading photos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageUpload(file);
    if (validationError) { toast.error(validationError); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = safeImageExt(compressed);
      const path = `party-photos/${invite.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('event-images').upload(path, compressed);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);

      await uploadPartyPhoto(invite.id, {
        uploadedByName: organizer?.business_name || 'Host',
        uploadedByGuestId: null,
        isHost: true,
        imageUrl: publicUrl,
        caption: caption.trim() || null,
      });
      setCaption('');
      await loadPhotos();
      toast.success('Photo uploaded');
    } catch (err) {
      console.error('Error uploading photo:', err);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId) {
    try {
      await deletePartyPhoto(photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      if (lightboxPhoto?.id === photoId) setLightboxPhoto(null);
      toast.success('Photo deleted');
    } catch {
      toast.error('Failed to delete photo');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            className="rounded-lg text-sm"
          />
        </div>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
          uploading ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white hover:bg-primary/90'
        }`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No photos yet. Upload the first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map(photo => (
            <div
              key={photo.id}
              className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer"
              onClick={() => setLightboxPhoto(photo)}
            >
              <img src={photo.image_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{photo.uploaded_by_name}</p>
                {photo.caption && <p className="text-white/80 text-[10px] truncate">{photo.caption}</p>}
              </div>
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                {photo.likes && photo.likes.length > 0 && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/40 text-white text-[10px]">
                    <Heart className="w-2.5 h-2.5 fill-red-400 text-red-400" /> {photo.likes.length}
                  </span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(photo.id); }}
                  className="p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 bg-black border-0">
          {lightboxPhoto && (
            <div>
              <img
                src={lightboxPhoto.image_url}
                alt={lightboxPhoto.caption || ''}
                className="w-full max-h-[80vh] object-contain"
              />
              <div className="p-4 bg-black/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {lightboxPhoto.uploaded_by_name}
                      {lightboxPhoto.is_host && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-300">Host</span>
                      )}
                    </p>
                    {lightboxPhoto.caption && (
                      <p className="text-white/70 text-sm mt-1">{lightboxPhoto.caption}</p>
                    )}
                    <p className="text-white/40 text-xs mt-1">
                      {formatDistanceToNow(new Date(lightboxPhoto.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lightboxPhoto.likes && lightboxPhoto.likes.length > 0 && (
                      <span className="flex items-center gap-1 text-white/60 text-sm">
                        <Heart className="w-4 h-4 fill-red-400 text-red-400" /> {lightboxPhoto.likes.length}
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(lightboxPhoto.id)}
                      className="p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
