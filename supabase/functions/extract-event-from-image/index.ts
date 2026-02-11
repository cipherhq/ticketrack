// Extract event details from flyer image using Claude Vision API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mediaType } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing image extraction, base64 length:', imageBase64.length);

    const validMediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const finalMediaType = validMediaTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: finalMediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Analyze this event flyer/poster image and extract all event details you can find. Return a JSON object with these fields (use null for any field you cannot determine):

{
  "title": "Event title/name",
  "description": "Brief description of the event based on what you see (at least 30 characters)",
  "eventType": "One of: Concert, Party/Club, Wedding, Comedy, Conference, Church Event, Festival, Sports, Theater, Exhibition, Workshop, Other",
  "category": "One of: Art & Culture, Charity & Fundraising, Comedy, Conferences, Fashion, Festivals, Film & Cinema, Food & Drink, Health & Wellness, Music, Networking, Parties & Nightlife, Religious, Sports & Fitness, Technology, Theater & Performing Arts, Travel & Outdoor, Workshops & Classes, Other",
  "startDate": "YYYY-MM-DD format if visible",
  "startTime": "HH:MM in 24h format if visible",
  "endDate": "YYYY-MM-DD format if visible (null if same as start)",
  "endTime": "HH:MM in 24h format if visible",
  "venueName": "Venue/location name if visible",
  "venueAddress": "Full address if visible",
  "city": "City name if visible",
  "country": "Country name if visible",
  "tickets": [
    {
      "name": "Ticket tier name (e.g. Regular, VIP, Early Bird)",
      "price": "Numeric price value (no currency symbol)",
      "description": "Brief ticket description if any"
    }
  ],
  "currency": "Currency code if price/currency is visible (USD, NGN, GBP, etc.)",
  "isAdultOnly": false,
  "dressCode": "Dress code if mentioned",
  "organizerName": "Organizer/host name if visible",
  "contactInfo": "Phone, email, or social media if visible"
}

IMPORTANT:
- Only extract information actually visible in the image
- For dates, use the correct year (assume 2025/2026 if year is not shown)
- For times, convert to 24h format (e.g., "8 PM" → "20:00")
- For prices, extract just the number without currency symbols
- Return ONLY the JSON object, no additional text or markdown`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error status:', response.status, 'body:', errorText);

      // If model not found, try fallback model
      if (response.status === 400 || response.status === 404) {
        console.log('Trying fallback model claude-3-5-sonnet-20241022');
        const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: finalMediaType,
                      data: imageBase64,
                    },
                  },
                  {
                    type: 'text',
                    text: `Analyze this event flyer/poster image and extract all event details. Return ONLY a JSON object with: title, description (30+ chars), eventType (Concert/Party/Club/Wedding/Comedy/Conference/Church Event/Festival/Sports/Theater/Exhibition/Workshop/Other), category, startDate (YYYY-MM-DD), startTime (HH:MM 24h), endDate, endTime, venueName, venueAddress, city, country, tickets (array of {name, price, description}), currency, isAdultOnly, dressCode. Use null for unknown fields. Return ONLY valid JSON.`,
                  },
                ],
              },
            ],
          }),
        });

        if (!fallbackResponse.ok) {
          const fbError = await fallbackResponse.text();
          console.error('Fallback model error:', fbError);
          return new Response(
            JSON.stringify({ success: false, error: 'AI extraction failed. Please try again.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const fbResult = await fallbackResponse.json();
        const fbText = fbResult.content?.find((c: any) => c.type === 'text')?.text || '';
        const fbJson = fbText.match(/\{[\s\S]*\}/);
        if (fbJson) {
          return new Response(
            JSON.stringify({ success: true, data: JSON.parse(fbJson[0]) }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const textContent = result.content?.find((c: any) => c.type === 'text')?.text || '';

    console.log('Claude response received, length:', textContent.length);

    // Parse the JSON from Claude's response
    let extracted;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', textContent.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'Could not parse extracted data. Please try a clearer image.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Extract event error:', err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
