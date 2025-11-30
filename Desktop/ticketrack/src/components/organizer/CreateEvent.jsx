import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/**
 * CREATE EVENT FORM
 * 
 * Multi-step form for creating a new event.
 */

export function CreateEvent() {
  const navigate = useNavigate();
  const { organizer } = useOutletContext();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    venue_name: '',
    venue_address: '',
    city: 'Lagos',
    state: 'Lagos',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '18:00',
    image_url: '',
  });

  // Ticket types
  const [ticketTypes, setTicketTypes] = useState([
    { name: 'Regular', price: 0, quantity: 100, description: '' }
  ]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('categories').select('*');
      setCategories(data || []);
    }
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTicketChange = (index, field, value) => {
    setTicketTypes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTicketType = () => {
    setTicketTypes(prev => [...prev, { name: '', price: 0, quantity: 100, description: '' }]);
  };

  const removeTicketType = (index) => {
    if (ticketTypes.length > 1) {
      setTicketTypes(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e, status = 'draft') => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.title || !formData.venue_name || !formData.start_date) {
      setError('Please fill in all required fields');
      return;
    }

    if (ticketTypes.some(t => !t.name || t.quantity < 1)) {
      setError('Please fill in all ticket type details');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const startDateTime = `${formData.start_date}T${formData.start_time}:00`;
      const endDateTime = formData.end_date 
        ? `${formData.end_date}T${formData.end_time}:00`
        : null;

      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          organizer_id: organizer.id,
          category_id: formData.category_id || null,
          title: formData.title,
          description: formData.description,
          venue_name: formData.venue_name,
          venue_address: formData.venue_address,
          city: formData.city,
          state: formData.state,
          country: 'Nigeria',
          start_date: startDateTime,
          end_date: endDateTime,
          image_url: formData.image_url || null,
          status: status,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Create ticket types
      const ticketInserts = ticketTypes.map(ticket => ({
        event_id: event.id,
        name: ticket.name,
        description: ticket.description,
        price: parseFloat(ticket.price) || 0,
        quantity_available: parseInt(ticket.quantity) || 100,
        currency: 'NGN',
      }));

      const { error: ticketError } = await supabase
        .from('ticket_types')
        .insert(ticketInserts);

      if (ticketError) throw ticketError;

      // Navigate to event management
      navigate(`/organizer/events/${event.id}`);
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-600">Fill in the details to create your event</p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Event Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Give your event a catchy title"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Tell attendees what to expect..."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Event Image URL
              </label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-gray-500">Paste a URL to your event image</p>
            </div>
          </div>
        </section>

        {/* Date & Time */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Date & Time</h2>
          
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Time *
              </label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Time
              </label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </section>

        {/* Location */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Location</h2>
          
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Venue Name *
              </label>
              <input
                type="text"
                name="venue_name"
                value={formData.venue_name}
                onChange={handleChange}
                placeholder="e.g., Landmark Centre"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                name="venue_address"
                value={formData.venue_address}
                onChange={handleChange}
                placeholder="Street address"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tickets */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Ticket Types</h2>
            <button
              type="button"
              onClick={addTicketType}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Ticket Type
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {ticketTypes.map((ticket, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500">Ticket #{index + 1}</span>
                  {ticketTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Name *</label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => handleTicketChange(index, 'name', e.target.value)}
                      placeholder="e.g., Regular, VIP"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price (₦)</label>
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => handleTicketChange(index, 'price', e.target.value)}
                      min="0"
                      placeholder="0 for free"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500">Quantity *</label>
                    <input
                      type="number"
                      value={ticket.quantity}
                      onChange={(e) => handleTicketChange(index, 'quantity', e.target.value)}
                      min="1"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-500">Description</label>
                  <input
                    type="text"
                    value={ticket.description}
                    onChange={(e) => handleTicketChange(index, 'description', e.target.value)}
                    placeholder="What's included with this ticket?"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/organizer/events')}
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-gray-600 px-6 py-3 font-medium text-white hover:bg-gray-700 disabled:bg-gray-300"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'published')}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600 disabled:bg-gray-300"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
