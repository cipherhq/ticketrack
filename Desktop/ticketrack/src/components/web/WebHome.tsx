import { useNavigate } from 'react-router';
import { Search, Calendar, MapPin, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';

const featuredEvents = [
  {
    id: '1',
    name: 'Lagos Tech Summit 2024',
    date: 'Dec 15, 2024',
    location: 'Eko Convention Center',
    city: 'Lagos',
    category: 'Technology',
    price: 'From ₦15,000',
    image: 'tech conference',
    distance: 2.5,
  },
  {
    id: '2',
    name: 'Afrobeats Festival',
    date: 'Dec 25, 2024',
    location: 'Landmark Event Center',
    city: 'Lagos',
    category: 'Music',
    price: 'From ₦35,000',
    image: 'music festival',
    distance: 5.2,
  },
  {
    id: '3',
    name: 'Business Conference 2024',
    date: 'Dec 20, 2024',
    location: 'Lagos Business School',
    city: 'Lagos',
    category: 'Business',
    price: 'From ₦25,000',
    image: 'business conference',
    distance: 8.1,
  },
  {
    id: '4',
    name: 'Food Festival',
    date: 'Dec 22, 2024',
    location: 'Muri Okunola Park',
    city: 'Lagos',
    category: 'Food',
    price: 'From ₦10,000',
    image: 'food festival',
    distance: 3.7,
  },
];

const eventsNearYou = [
  {
    id: '5',
    name: 'Lagos Tech Summit',
    date: 'Dec 15, 2024',
    location: 'Eko Convention Center',
    city: 'Lagos',
    category: 'Technology',
    price: 'From ₦15,000',
    image: 'tech conference',
    distance: 2.5,
  },
  {
    id: '6',
    name: 'Food Festival',
    date: 'Dec 22, 2024',
    location: 'Muri Okunola Park',
    city: 'Lagos',
    category: 'Food',
    price: 'From ₦10,000',
    image: 'food festival',
    distance: 3.7,
  },
  {
    id: '7',
    name: 'Comedy Night',
    date: 'Jan 10, 2025',
    location: 'Eko Hotel',
    city: 'Lagos',
    category: 'Comedy',
    price: 'From ₦20,000',
    image: 'comedy show',
    distance: 4.8,
  },
  {
    id: '8',
    name: 'Sports Tournament',
    date: 'Dec 28, 2024',
    location: 'National Stadium',
    city: 'Lagos',
    category: 'Sports',
    price: 'From ₦5,000',
    image: 'sports event',
    distance: 6.3,
  },
];

const categories = [
  { name: 'Technology', icon: '💻', count: 45 },
  { name: 'Music', icon: '🎵', count: 89 },
  { name: 'Business', icon: '💼', count: 34 },
  { name: 'Sports', icon: '⚽', count: 23 },
  { name: 'Education', icon: '📚', count: 67 },
  { name: 'Entertainment', icon: '🎭', count: 56 },
];

export function WebHome() {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = () => {};
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1E4FCC] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="bg-white/20 text-white border-0 rounded-full mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Trusted by 10,000+ event organizers
            </Badge>
            <h1 className="text-5xl md:text-6xl mb-6">
              Discover Amazing Events Near You
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Book tickets for concerts, conferences, festivals, and more. Your next experience
              starts here.
            </p>

            {/* Search Bar */}
            <div className="bg-white rounded-2xl p-2 flex flex-col md:flex-row gap-2 shadow-xl">
              <div className="flex-1 flex items-center gap-2 px-4">
                <Search className="w-5 h-5 text-[#0F0F0F]/40" />
                <Input
                  placeholder="Search for events..."
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[#0F0F0F]"
                />
              </div>
              <Button
                onClick={() => navigate('/web/events')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8"
              >
                Search Events
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl text-[#0F0F0F] mb-8">Browse by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <Card
              key={category.name}
              className="border-[#0F0F0F]/10 rounded-2xl cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/web/events')}
            >
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="text-[#0F0F0F] mb-1">{category.name}</h3>
                <p className="text-sm text-[#0F0F0F]/60">{category.count} events</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured Events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl text-[#0F0F0F]">Featured Events</h2>
          <Button
            variant="ghost"
            onClick={() => navigate('/web/events')}
            className="rounded-xl text-[#2969FF]"
          >
            View All
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredEvents.slice(0, 3).map((event) => (
            <Card
              key={event.id}
              className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/web/event/${event.id}`)}
            >
              <div className="aspect-video bg-[#F4F6FA] relative overflow-hidden">
                <ImageWithFallback
                  src={`https://source.unsplash.com/800x600/?${event.image}`}
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-4 left-4 bg-white text-[#0F0F0F] border-0 rounded-lg">
                  {event.category}
                </Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl text-[#0F0F0F] mb-3">{event.name}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{event.location}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[#0F0F0F]/10">
                  <span className="text-[#2969FF]">{event.price}</span>
                  <Button className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                    Get Tickets
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Events Near You */}
      <section className="bg-[#F4F6FA] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl text-[#0F0F0F] mb-2">Events Near You</h2>
              <p className="text-[#0F0F0F]/60">Happening in Lagos</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/web/search')}
              className="rounded-xl text-[#2969FF]"
            >
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {eventsNearYou.map((event) => (
              <Card
                key={event.id}
                className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-white"
                onClick={() => navigate(`/web/event/${event.id}`)}
              >
                <div className="aspect-video bg-[#F4F6FA] relative overflow-hidden">
                  <ImageWithFallback
                    src={`https://source.unsplash.com/800x600/?${event.image}`}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-3 right-3 bg-white text-[#0F0F0F] border-0 rounded-lg text-xs">
                    {event.distance}km away
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="text-[#0F0F0F] mb-2 line-clamp-1">{event.name}</h3>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                      <Calendar className="w-3 h-3" />
                      <span className="text-sm">{event.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#0F0F0F]/60">
                      <MapPin className="w-3 h-3" />
                      <span className="text-sm">{event.location}</span>
                    </div>
                  </div>
                  <div className="text-[#2969FF] text-sm">{event.price}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl text-[#0F0F0F] mb-4">Why Choose Ticketrack?</h2>
            <p className="text-[#0F0F0F]/60 max-w-2xl mx-auto">
              We make event ticketing simple, secure, and hassle-free
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl text-[#0F0F0F] mb-2">Instant Booking</h3>
              <p className="text-[#0F0F0F]/60">
                Get your tickets instantly via email and mobile app
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl text-[#0F0F0F] mb-2">Secure Payments</h3>
              <p className="text-[#0F0F0F]/60">
                Your payment information is always protected
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h3 className="text-xl text-[#0F0F0F] mb-2">Best Events</h3>
              <p className="text-[#0F0F0F]/60">
                Discover curated events from trusted organizers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1E4FCC] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/90 mb-8">
              Join thousands of event-goers discovering amazing experiences
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/web/signup')}
                className="bg-white hover:bg-white/90 text-[#2969FF] rounded-xl px-8 py-6 text-lg"
              >
                Sign Up Now
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/web/events')}
                className="border-white text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg"
              >
                Browse Events
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}