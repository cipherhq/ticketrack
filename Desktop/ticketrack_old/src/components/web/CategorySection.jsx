import React from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { id: 'tech', label: 'Tech & Innovation', icon: '💻', color: 'bg-slate-100 hover:bg-slate-200' },
  { id: 'music', label: 'Music & Concerts', icon: '🎵', color: 'bg-purple-100 hover:bg-purple-200' },
  { id: 'business', label: 'Business & Networking', icon: '💼', color: 'bg-amber-100 hover:bg-amber-200' },
  { id: 'sports', label: 'Sports & Fitness', icon: '⚽', color: 'bg-green-100 hover:bg-green-200' },
  { id: 'education', label: 'Education & Workshops', icon: '📚', color: 'bg-red-100 hover:bg-red-200' },
  { id: 'arts', label: 'Arts & Culture', icon: '🎨', color: 'bg-pink-100 hover:bg-pink-200' },
  { id: 'food', label: 'Food & Drinks', icon: '🍽️', color: 'bg-orange-100 hover:bg-orange-200' },
  { id: 'comedy', label: 'Comedy & Entertainment', icon: '🎭', color: 'bg-yellow-100 hover:bg-yellow-200' },
];

export function CategorySection() {
  const navigate = useNavigate();

  const handleCategoryClick = (categoryId) => {
    navigate(`/events?category=${categoryId}`);
  };

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Browse by Category</h2>
          <p className="mt-2 text-gray-600">Find events that match your interests</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`group flex flex-col items-center justify-center rounded-2xl ${category.color} p-6 transition-all duration-200 hover:scale-105 hover:shadow-lg`}
            >
              <span className="mb-3 text-4xl transition-transform duration-200 group-hover:scale-110">
                {category.icon}
              </span>
              <span className="text-center text-sm font-medium text-gray-700">
                {category.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
