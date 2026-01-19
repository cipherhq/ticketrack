import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, Clock, User, ArrowRight, Search, TrendingUp, BookOpen, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

// Blog posts data
const blogPosts = [
  {
    id: 1,
    title: 'The Complete Guide to Creating Your First Event on Ticketrack',
    slug: 'complete-guide-creating-first-event-ticketrack',
    excerpt: 'Learn step-by-step how to set up your first event on Ticketrack, from event creation to ticket pricing and marketing strategies.',
    author: 'Ticketrack Team',
    date: '2024-01-15',
    readTime: '12 min read',
    category: 'Getting Started',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
    featured: true,
    tags: ['event creation', 'ticketing', 'getting started']
  },
  {
    id: 2,
    title: '10 Proven Strategies to Sell Out Your Events in Nigeria',
    slug: '10-proven-strategies-sell-out-events-nigeria',
    excerpt: 'Discover the most effective marketing and pricing strategies used by successful Nigerian event organizers to consistently sell out their events.',
    author: 'Ticketrack Team',
    date: '2024-01-10',
    readTime: '15 min read',
    category: 'Marketing',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=400&fit=crop',
    featured: true,
    tags: ['sell out', 'nigeria', 'marketing', 'event promotion']
  },
  {
    id: 3,
    title: 'Mastering Event Pricing: How to Price Your Tickets for Maximum Revenue',
    slug: 'mastering-event-pricing-maximum-revenue',
    excerpt: 'Learn the psychology of pricing, dynamic pricing strategies, and how to find the sweet spot that maximizes both attendance and revenue.',
    author: 'Ticketrack Team',
    date: '2024-01-08',
    readTime: '10 min read',
    category: 'Revenue',
    image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800&h=400&fit=crop',
    featured: false,
    tags: ['pricing', 'revenue', 'strategy']
  },
  {
    id: 4,
    title: 'Building Your Event Brand: A Guide for Nigerian Event Organizers',
    slug: 'building-event-brand-guide-nigerian-organizers',
    excerpt: 'Establish a strong event brand that resonates with your Nigerian audience. Learn branding strategies that work in the local market.',
    author: 'Ticketrack Team',
    date: '2024-01-05',
    readTime: '11 min read',
    category: 'Branding',
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=800&h=400&fit=crop',
    featured: false,
    tags: ['branding', 'nigeria', 'event organizer', 'brand identity']
  },
  {
    id: 5,
    title: 'Social Media Marketing for Events: Reaching Your Audience in Nigeria',
    slug: 'social-media-marketing-events-nigeria',
    excerpt: 'Master Instagram, Twitter, Facebook, and TikTok marketing to promote your events effectively in the Nigerian market.',
    author: 'Ticketrack Team',
    date: '2024-01-03',
    readTime: '14 min read',
    category: 'Marketing',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=400&fit=crop',
    featured: false,
    tags: ['social media', 'marketing', 'nigeria', 'instagram', 'promotion']
  },
  {
    id: 6,
    title: 'The Ultimate Checklist: Everything You Need to Host a Successful Event',
    slug: 'ultimate-checklist-host-successful-event',
    excerpt: 'A comprehensive pre-event, day-of, and post-event checklist to ensure nothing falls through the cracks.',
    author: 'Ticketrack Team',
    date: '2024-01-01',
    readTime: '13 min read',
    category: 'Planning',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop',
    featured: false,
    tags: ['checklist', 'planning', 'event management']
  },
  {
    id: 7,
    title: 'Early Bird Pricing: How to Drive Initial Sales and Create Urgency',
    slug: 'early-bird-pricing-drive-sales-create-urgency',
    excerpt: 'Learn how early bird pricing can boost your ticket sales, create FOMO, and maximize revenue with strategic pricing tiers.',
    author: 'Ticketrack Team',
    date: '2023-12-28',
    readTime: '9 min read',
    category: 'Revenue',
    image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=400&fit=crop',
    featured: false,
    tags: ['pricing', 'early bird', 'sales strategy', 'FOMO']
  },
  {
    id: 8,
    title: 'Networking and Partnerships: Growing Your Event Organizer Network in Nigeria',
    slug: 'networking-partnerships-growing-event-organizer-network-nigeria',
    excerpt: 'Build valuable partnerships with venues, vendors, influencers, and other organizers to grow your event business in Nigeria.',
    author: 'Ticketrack Team',
    date: '2023-12-25',
    readTime: '12 min read',
    category: 'Growth',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=400&fit=crop',
    featured: false,
    tags: ['networking', 'partnerships', 'nigeria', 'business growth']
  },
  {
    id: 9,
    title: 'Using Analytics to Improve Your Events: Making Data-Driven Decisions',
    slug: 'using-analytics-improve-events-data-driven-decisions',
    excerpt: 'Leverage Ticketrack analytics to understand your audience, optimize marketing spend, and improve event ROI.',
    author: 'Ticketrack Team',
    date: '2023-12-22',
    readTime: '10 min read',
    category: 'Analytics',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop',
    featured: false,
    tags: ['analytics', 'data', 'ROI', 'optimization']
  },
  {
    id: 10,
    title: 'Scaling Your Event Business: From First Event to Sell-Out Success',
    slug: 'scaling-event-business-first-event-sell-out-success',
    excerpt: 'Learn how successful Nigerian event organizers scaled from their first event to hosting sell-out shows with thousands of attendees.',
    author: 'Ticketrack Team',
    date: '2023-12-20',
    readTime: '16 min read',
    category: 'Growth',
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
    featured: true,
    tags: ['scaling', 'growth', 'nigeria', 'sell out', 'business']
  }
]

const categories = ['All', 'Getting Started', 'Marketing', 'Revenue', 'Branding', 'Planning', 'Growth', 'Analytics']

export function WebBlog() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const featuredPosts = blogPosts.filter(post => post.featured)
  const regularPosts = filteredPosts.filter(post => !post.featured)

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Expert insights, tips, and strategies to help you create successful events and grow your event business.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search and Filters */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-xl border-[#0F0F0F]/10"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[#2969FF] text-white'
                    : 'bg-white text-[#0F0F0F] border border-[#0F0F0F]/10 hover:border-[#2969FF]/30'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Posts */}
        {!searchQuery && selectedCategory === 'All' && featuredPosts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#2969FF]" />
              Featured Articles
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featuredPosts.map((post) => (
                <Card
                  key={post.id}
                  className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/blog/${post.slug}`)}
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-[#2969FF] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Featured
                      </span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="bg-white/90 text-[#0F0F0F] text-xs font-medium px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 text-sm text-[#0F0F0F]/60 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(post.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {post.readTime}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0F0F0F] mb-3 group-hover:text-[#2969FF] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-[#0F0F0F]/60 text-sm mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[#0F0F0F]/60">
                        <User className="w-4 h-4" />
                        {post.author}
                      </div>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="text-[#2969FF] font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Read More
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* All Posts */}
        <section>
          <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">
            {searchQuery ? `Search Results (${filteredPosts.length})` : selectedCategory === 'All' ? 'All Articles' : `${selectedCategory} Articles`}
          </h2>
          
          {filteredPosts.length === 0 ? (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="py-12 text-center">
                <Search className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">No articles found. Try adjusting your search or filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => (
                <Card
                  key={post.id}
                  className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(`/blog/${post.slug}`)}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="bg-white/90 text-[#0F0F0F] text-xs font-medium px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 text-xs text-[#0F0F0F]/60 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(post.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0F0F0F] mb-2 group-hover:text-[#2969FF] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-[#0F0F0F]/60 text-sm mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                      {post.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-xs bg-[#F4F6FA] text-[#0F0F0F]/60 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="text-[#2969FF] font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Read More
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default WebBlog
