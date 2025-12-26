import { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

// Common emoji icons for event categories
const EMOJI_OPTIONS = [
  '🎵', '🎭', '🎪', '⚽', '🎤', '🍽️', '📚', '🤝', '❤️', '📅',
  '🎬', '🎨', '🎸', '🏃', '🎯', '🎲', '🎮', '💼', '🌟', '🎉',
  '🏆', '🎹', '🎻', '🎺', '🥁', '🎷', '🎸', '🎤', '🎧', '🎼',
];

export function AdminCategories() {
  // State for categories list
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '📅',
    description: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  
  // State for delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Function to load all categories from database
  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate slug from name
  // Example: "Music & Concerts" → "music-concerts"
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')          // Replace spaces with hyphens
      .replace(/-+/g, '-')           // Remove multiple hyphens
      .trim();
  };

  // Handle name change and auto-generate slug
  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  // Open modal for adding new category
  const openAddModal = () => {
    setModalMode('add');
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      icon: '📅',
      description: '',
      is_active: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  // Open modal for editing existing category
  const openEditModal = (category) => {
    setModalMode('edit');
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      slug: category.slug || '',
      icon: category.icon || '📅',
      description: category.description || '',
      is_active: category.is_active ?? true,
    });
    setFormError('');
    setModalOpen(true);
  };

  // Save category (add or edit)
  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }
    if (!formData.slug.trim()) {
      setFormError('Slug is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (modalMode === 'add') {
        // Check if slug already exists
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', formData.slug)
          .single();

        if (existing) {
          setFormError('A category with this slug already exists');
          setSaving(false);
          return;
        }

        // Insert new category
        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            icon: formData.icon,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          });

        if (error) {
          console.error('Error adding category:', error);
          setFormError(error.message || 'Failed to add category');
          setSaving(false);
          return;
        }
      } else {
        // Check if slug already exists (excluding current category)
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', formData.slug)
          .neq('id', editingCategory.id)
          .single();

        if (existing) {
          setFormError('A category with this slug already exists');
          setSaving(false);
          return;
        }

        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            icon: formData.icon,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          })
          .eq('id', editingCategory.id);

        if (error) {
          console.error('Error updating category:', error);
          setFormError(error.message || 'Failed to update category');
          setSaving(false);
          return;
        }
      }

      // Success - close modal and reload
      setModalOpen(false);
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      setFormError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (category) => {
    setDeletingCategory(category);
    setDeleteModalOpen(true);
  };

  // Delete category
  const handleDelete = async () => {
    if (!deletingCategory) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category: ' + error.message);
        return;
      }

      // Success - close modal and reload
      setDeleteModalOpen(false);
      setDeletingCategory(null);
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('An unexpected error occurred');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle category active status directly from table
  const handleToggleActive = async (category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) {
        console.error('Error toggling category:', error);
        return;
      }

      // Update local state immediately for better UX
      setCategories(categories.map(c => 
        c.id === category.id ? { ...c, is_active: !c.is_active } : c
      ));
    } catch (error) {
      console.error('Error toggling category:', error);
    }
  };

  // Filter categories based on search query
  const filteredCategories = categories.filter((category) =>
    category.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats for the cards at the top
  const stats = {
    total: categories.length,
    active: categories.filter(c => c.is_active).length,
    inactive: categories.filter(c => !c.is_active).length,
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Event Categories</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage categories for event classification</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadCategories} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={openAddModal} className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Categories</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Active</p>
                <p className="text-2xl font-semibold text-green-600">{stats.active}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Inactive</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]/40">{stats.inactive}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
            <Input
              placeholder="Search categories by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-[#0F0F0F]/10 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Categories ({filteredCategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Icon</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Name</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Slug</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Description</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                    <td className="py-4 px-4">
                      <span className="text-2xl">{category.icon || '📅'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{category.name}</p>
                    </td>
                    <td className="py-4 px-4">
                      <code className="text-sm bg-[#F4F6FA] px-2 py-1 rounded text-[#0F0F0F]/70">
                        {category.slug}
                      </code>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/60 text-sm truncate max-w-xs">
                        {category.description || '—'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={category.is_active}
                          onCheckedChange={() => handleToggleActive(category)}
                        />
                        <Badge className={category.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                        }>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditModal(category)}
                          className="rounded-xl h-9 w-9"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openDeleteModal(category)}
                          className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#0F0F0F]/60">
                      {searchQuery ? 'No categories match your search' : 'No categories found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'add' ? 'Add New Category' : 'Edit Category'}
            </DialogTitle>
            <DialogDescription>
              {modalMode === 'add' 
                ? 'Create a new category for events' 
                : 'Update the category details'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Error Message */}
            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4" />
                {formError}
              </div>
            )}

            {/* Icon Selector */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-[#F4F6FA] rounded-xl max-h-32 overflow-y-auto">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-colors ${
                      formData.icon === emoji 
                        ? 'bg-[#2969FF] ring-2 ring-[#2969FF]' 
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Music & Concerts"
                value={formData.name}
                onChange={handleNameChange}
                className="rounded-xl"
              />
            </div>

            {/* Slug (auto-generated but editable) */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                placeholder="e.g., music-concerts"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="rounded-xl font-mono text-sm"
              />
              <p className="text-xs text-[#0F0F0F]/50">
                URL-friendly identifier. Auto-generated from name.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this category..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-[#0F0F0F]/50">
                  Inactive categories won't appear in event creation
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                modalMode === 'add' ? 'Add Category' : 'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
            <span className="text-3xl">{deletingCategory?.icon}</span>
            <div>
              <p className="font-medium text-[#0F0F0F]">{deletingCategory?.name}</p>
              <p className="text-sm text-[#0F0F0F]/60">{deletingCategory?.slug}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Category
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
