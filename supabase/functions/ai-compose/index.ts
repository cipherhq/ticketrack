import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { errorResponse, logError } from '../_shared/errorHandler.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, context, type } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the type of content to generate
    const isEventDescription = type === 'event_description' || prompt.includes('event description') || prompt.includes('Event Title:');

    let systemPrompt;
    let userMessage;

    if (isEventDescription) {
      // Event description generation
      systemPrompt = `You are an expert event copywriter. Write engaging, professional event descriptions.

CRITICAL RULES:
1. NEVER use placeholder variables like {{event_name}}, {{event_date}}, {{venue_name}}, etc.
2. NEVER use brackets or curly braces around any text
3. Write naturally using the actual event details provided
4. If a detail is not provided, either omit it or write "details coming soon"

Write compelling content that:
- Hooks readers in the first sentence
- Highlights key benefits of attending
- Creates excitement and urgency
- Is professional yet engaging

Use HTML tags like <p>, <strong>, <ul>, <li> for formatting.
Respond ONLY with the description text, no JSON, no quotes, no extra formatting.`;

      userMessage = prompt;
    } else {
      // Email composition
      systemPrompt = `You are an email copywriter for event organizers. Write professional, friendly, and engaging email content.

IMPORTANT: Use the ACTUAL event details provided below in your content. DO NOT use placeholder variables like {{event_name}} or {{event_date}} - write the real values directly.

Event Details:
- Event Name: ${context?.eventName || 'Event'}
- Event Date: ${context?.eventDate || 'TBA'}
- Event Time: ${context?.eventTime || ''}
- Venue: ${context?.venueName || 'TBA'}
- City: ${context?.eventCity || ''}
- Organizer: ${context?.organizerName || 'Event Organizer'}

The ONLY placeholder you may use is {{attendee_name}} for the recipient's name (this will be personalized per recipient).

Return your response in this exact JSON format:
{
  "subject": "Your email subject line here",
  "body": "<p>Your HTML email body here.</p><p>Use proper HTML tags for formatting.</p>"
}

Keep the email concise, professional, and action-oriented. Use HTML formatting with <p>, <strong>, <a> tags. Write the actual event name, date, venue in the content - NOT placeholders.`;

      userMessage = `Write an email for: ${prompt}`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      throw new Error(`Groq error: ${error}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated');
    }

    // Remove any placeholder variables that might have slipped through
    content = content.replace(/\{\{[^}]+\}\}/g, '');
    // Also remove any leftover brackets that might confuse things
    content = content.replace(/\[\[.*?\]\]/g, '');

    // Parse JSON from the response (for email type)
    let result;

    if (isEventDescription) {
      // For event descriptions, return the content directly
      // Clean up any JSON artifacts if AI still returned JSON
      let cleanContent = content;
      try {
        const parsed = JSON.parse(content);
        cleanContent = parsed.body || parsed.content || parsed.description || content;
      } catch {
        // Not JSON, use as-is (expected behavior)
      }

      result = {
        body: cleanContent.trim(),
        content: cleanContent.trim()
      };
    } else {
      // For emails, expect JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: use content as body
        result = {
          subject: 'Your Event Update',
          body: `<p>${content.replace(/\n/g, '</p><p>')}</p>`
        };
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logError('ai-compose', error);
    return errorResponse('SRV_001', 500, error, undefined, corsHeaders);
  }
});
