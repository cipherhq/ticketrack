import { useState, useEffect } from 'react';
import { Loader2, Trash2, Send, MessageSquare, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getWallPosts, createWallPost, deleteWallPost, logActivity } from '@/services/partyInvites';
import { compressImage } from '@/lib/imageCompression';
import { formatDistanceToNow } from 'date-fns';

export function WallTab({ invite, organizer }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    loadPosts();
  }, [invite.id]);

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await getWallPosts(invite.id);
      setPosts(data);
    } catch (err) {
      console.error('Error loading wall posts:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  async function uploadImage(file) {
    const compressed = await compressImage(file);
    const ext = compressed.name.split('.').pop();
    const path = `party-wall/${invite.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, compressed);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
    return publicUrl;
  }

  async function handlePost() {
    if (!content.trim() && !imageFile) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      await createWallPost(invite.id, {
        authorName: organizer?.business_name || 'Host',
        authorEmail: null,
        authorGuestId: null,
        isHost: true,
        content: content.trim(),
        imageUrl,
      });
      await logActivity(invite.id, 'wall_post', organizer?.business_name || 'Host', { isHost: true });
      setContent('');
      clearImage();
      await loadPosts();
      toast.success('Post added');
    } catch (err) {
      console.error('Error creating post:', err);
      toast.error('Failed to post');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(postId) {
    try {
      await deleteWallPost(postId);
      await logActivity(invite.id, 'wall_post_deleted', organizer?.business_name || 'Host');
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted');
    } catch (err) {
      console.error('Error deleting post:', err);
      toast.error('Failed to delete post');
    }
  }

  return (
    <div className="space-y-4">
      {/* Post input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write a message to your guests..."
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
          />
          <div className="flex flex-col gap-1 self-end">
            <label className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors" title="Add image">
              <Camera className="w-4 h-4 text-gray-400" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </label>
            <Button
              onClick={handlePost}
              disabled={(!content.trim() && !imageFile) || posting}
              className="rounded-xl gap-1"
              size="sm"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg" />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No posts yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="flex gap-3 p-3 rounded-xl bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-gray-600">
                  {(post.author_name || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{post.author_name}</span>
                  {post.is_host && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Host</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                </div>
                {post.content && (
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{post.content}</p>
                )}
                {post.image_url && (
                  <img src={post.image_url} alt="" className="mt-2 max-w-full max-h-64 rounded-lg object-cover" />
                )}
              </div>
              <button
                onClick={() => handleDelete(post.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors self-start shrink-0"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
