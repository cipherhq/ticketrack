import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const mockEvents = [
  {
    id: 1,
    name: 'Summer Music Festival',
    date: 'Dec 15, 2025',
    status: 'Published',
    sold: 450,
    total: 500,
    revenue: '₦675,000',
  },
  {
    id: 2,
    name: 'Tech Conference',
    date: 'Jan 10, 2026',
    status: 'Published',
    sold: 320,
    total: 400,
    revenue: '₦800,000',
  },
  {
    id: 3,
    name: 'Business Summit',
    date: 'Jan 25, 2026',
    status: 'Draft',
    sold: 0,
    total: 300,
    revenue: '₦0',
  },
];

export function EventManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState(mockEvents);

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteEvent = (id) => {
    if (confirm('Are you sure you want to delete this event?')) {
      setEvents(events.filter(e => e.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Event Management</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Create and manage your events</p>
        </div>
        <Button
          onClick={() => navigate('/organizer/create-event')}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Event
        </Button>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 rounded-xl bg-[#F4F6FA] border-0"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#0F0F0F]/60 mb-4">No events found</p>
              <Button
                onClick={() => navigate('/organizer/create-event')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl bg-[#F4F6FA] flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-[#0F0F0F]">{event.name}</h4>
                      <Badge
                        className={`${
                          event.status === 'Published'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-[#0F0F0F]/10 text-[#0F0F0F]/60'
                        }`}
                      >
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-[#0F0F0F]/60">
                      <span>{event.date}</span>
                      <span>
                        {event.sold}/{event.total} sold
                      </span>
                      <span className="text-[#2969FF] font-medium">{event.revenue}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/organizer/events/${event.id}`)}
                      className="rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                      className="rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-lg">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/edit`)}>
                          Edit Event
                        </DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteEvent(event.id)}
                          className="text-red-600"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
