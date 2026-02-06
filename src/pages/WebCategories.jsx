import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  Music, Mic2, PartyPopper, Trophy, Drama, UtensilsCrossed,
  Wine, Laugh, Leaf, HeartHandshake, Gamepad2, GraduationCap,
  Briefcase, Baby, Sparkles, Loader2, ArrowLeft
} from 'lucide-react';

// Category icons mapping
const categoryIcons = {
  'music-concerts': Music,
  'conferences': Mic2,
  'festivals': PartyPopper,
  'sports': Trophy,
  'arts-theatre': Drama,
  'food-drink': UtensilsCrossed,
  'nightlife': Wine,
  'comedy': Laugh,
  'wellness': Leaf,
  'charity': HeartHandshake,
  'gaming': Gamepad2,
  'education': GraduationCap,
  'business': Briefcase,
  'kids-family': Baby,
};

export function WebCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1a4fd8] text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-4">Browse by Category</h1>
          <p className="text-white/80 text-lg max-w-2xl">
            Find events that match your interests. From concerts to conferences,
            there's something for everyone.
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((category) => {
            const IconComponent = categoryIcons[category.slug] || Sparkles;

            return (
              <Link
                key={category.id}
                to={`/events?category=${category.slug}`}
                className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-100"
              >
                {/* Icon */}
                <div className="w-14 h-14 bg-gradient-to-br from-[#2969FF] to-[#1a4fd8] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <IconComponent className="w-7 h-7 text-white" strokeWidth={2} />
                </div>

                {/* Category Info */}
                <h3 className="font-semibold text-[#0F0F0F] text-lg mb-1">
                  {category.name}
                </h3>
                {category.event_count > 0 && (
                  <p className="text-[#0F0F0F]/60 text-sm">
                    {category.event_count} event{category.event_count !== 1 ? 's' : ''}
                  </p>
                )}

                {/* Description if available */}
                {category.description && (
                  <p className="text-[#0F0F0F]/50 text-sm mt-2 line-clamp-2">
                    {category.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No categories available</p>
          </div>
        )}
      </div>
    </div>
  );
}
