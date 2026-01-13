import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      action, // 'compose', 'improve', 'subject', 'tone'
      prompt, 
      existingText,
      tone = 'professional', // professional, friendly, urgent, casual
      context, // event details, recipient type, etc.
      recipientType // attendees, promoters, organizers
    } = await req.json();

    let systemPrompt = '';
    let userPrompt = '';

    switch (action) {
      case 'compose':
        systemPrompt = `You are an expert email copywriter for an event ticketing platform called Ticketrack. 
Write compelling, clear, and ${tone} emails.
Always be concise and action-oriented.
Use proper formatting with paragraphs.
Do not use excessive exclamation marks.
Include a clear call-to-action when appropriate.
Return JSON format: { "subject": "...", "body": "..." }`;
        
        userPrompt = `Write an email for the following purpose:
${prompt}

Recipient type: ${recipientType || 'attendees'}
Tone: ${tone}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Return only valid JSON with "subject" and "body" fields.`;
        break;

      case 'improve':
        systemPrompt = `You are an expert email editor. Improve the given email text to be more ${tone}, clear, and engaging.
Maintain the original intent but enhance clarity and impact.
Return JSON format: { "subject": "...", "body": "..." }`;
        
        userPrompt = `Improve this email:
Subject: ${existingText?.subject || ''}
Body: ${existingText?.body || ''}

Make it more ${tone}.
Return only valid JSON with "subject" and "body" fields.`;
        break;

      case 'subject':
        systemPrompt = `You are an expert at writing email subject lines for an event platform.
Write compelling subject lines that get opened.
Return JSON format: { "suggestions": ["subject1", "subject2", "subject3"] }`;
        
        userPrompt = `Generate 3 ${tone} subject line suggestions for an email about:
${prompt}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Return only valid JSON with "suggestions" array.`;
        break;

      case 'tone':
        systemPrompt = `You are an expert email editor. Adjust the tone of the email to be ${tone}.
Keep the same message but change the writing style.
Return JSON format: { "subject": "...", "body": "..." }`;
        
        userPrompt = `Change the tone of this email to ${tone}:
Subject: ${existingText?.subject || ''}
Body: ${existingText?.body || ''}

Return only valid JSON with "subject" and "body" fields.`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: compose, improve, subject, or tone' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'AI service error', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // If JSON parsing fails, return the raw content
      result = { raw: content };
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
