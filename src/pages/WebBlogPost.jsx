import { useParams, Link, useNavigate } from 'react-router-dom'
import { Calendar, Clock, User, ArrowLeft, Share2, BookOpen, Tag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DOMPurify from 'dompurify'

// Full blog posts content
const blogPosts = {
  'complete-guide-creating-first-event-ticketrack': {
    id: 1,
    title: 'The Complete Guide to Creating Your First Event on Ticketrack',
    slug: 'complete-guide-creating-first-event-ticketrack',
    excerpt: 'Learn step-by-step how to set up your first event on Ticketrack, from event creation to ticket pricing and marketing strategies.',
    author: 'Ticketrack Team',
    date: '2024-01-15',
    readTime: '12 min read',
    category: 'Getting Started',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=600&fit=crop',
    tags: ['event creation', 'ticketing', 'getting started'],
    content: `
      <h2>Introduction</h2>
      <p>Creating your first event on Ticketrack is an exciting step towards connecting with your audience and bringing your vision to life. Whether you're planning a concert, conference, workshop, or any other gathering, this comprehensive guide will walk you through every step of the process.</p>
      
      <h2>Step 1: Setting Up Your Organizer Account</h2>
      <p>Before creating your first event, you'll need to set up your organizer account on Ticketrack. This is a straightforward process:</p>
      <ul>
        <li>Sign up for a Ticketrack account if you haven't already</li>
        <li>Navigate to the Organizer Dashboard</li>
        <li>Complete your organizer profile with business information</li>
        <li>Verify your email address</li>
        <li>Set up your payment preferences</li>
      </ul>
      
      <h2>Step 2: Creating Your Event</h2>
      <p>Once your organizer account is set up, you're ready to create your first event. Click the "Create Event" button in your dashboard and follow these steps:</p>
      
      <h3>Basic Event Information</h3>
      <p>Start by entering the fundamental details:</p>
      <ul>
        <li><strong>Event Title:</strong> Choose a clear, descriptive title that tells people what your event is about</li>
        <li><strong>Event Description:</strong> Write a compelling description that highlights what attendees will experience</li>
        <li><strong>Category:</strong> Select the most appropriate category for your event</li>
        <li><strong>Event Type:</strong> Choose between single-day, multi-day, or recurring event</li>
      </ul>
      
      <h3>Event Dates and Venue</h3>
      <p>Set your event date and time, and choose a venue location. Ticketrack's location picker makes it easy to search for venues or enter a custom address.</p>
      
      <h2>Step 3: Setting Up Ticket Types</h2>
      <p>One of Ticketrack's most powerful features is the ability to create multiple ticket types for a single event. Here's how to leverage this:</p>
      
      <h3>Early Bird Tickets</h3>
      <p>Create early bird pricing to incentivize early purchases. This creates urgency and helps you gauge initial interest in your event.</p>
      
      <h3>VIP and Premium Options</h3>
      <p>Offer VIP tickets with added benefits like front-row seating, meet-and-greets, or exclusive access areas. These higher-priced options can significantly boost your revenue.</p>
      
      <h3>Group Discounts</h3>
      <p>Set up group pricing for attendees buying multiple tickets. This is especially effective for corporate events or family gatherings.</p>
      
      <h2>Step 4: Pricing Your Tickets</h2>
      <p>Pricing is crucial for event success. Consider these factors:</p>
      <ul>
        <li>Your target audience's spending capacity</li>
        <li>Similar events in your area and their pricing</li>
        <li>Your costs (venue, performers, catering, etc.)</li>
        <li>Desired profit margin</li>
      </ul>
      
      <p>Ticketrack allows you to pass service fees to attendees or absorb them yourself. Consider your pricing strategy carefully, as transparency builds trust with your audience.</p>
      
      <h2>Step 5: Event Marketing on Ticketrack</h2>
      <p>Once your event is created, Ticketrack provides several built-in marketing tools:</p>
      
      <h3>Social Sharing</h3>
      <p>Every event page has social sharing buttons. Encourage early ticket holders to share the event with their networks.</p>
      
      <h3>Email Campaigns</h3>
      <p>Use Ticketrack's email campaign feature to send updates, reminders, and special offers to your attendee list.</p>
      
      <h3>Promoter Network</h3>
      <p>Leverage Ticketrack's promoter network to expand your reach. Set up commission-based promoter tracking to incentivize others to promote your event.</p>
      
      <h2>Step 6: Managing Your Event</h2>
      <p>As your event approaches, use Ticketrack's dashboard to:</p>
      <ul>
        <li>Monitor ticket sales in real-time</li>
        <li>Track revenue and analytics</li>
        <li>Manage attendee communications</li>
        <li>Handle refund requests</li>
        <li>Export attendee lists for check-in</li>
      </ul>
      
      <h2>Step 7: Event Day</h2>
      <p>On the day of your event, Ticketrack's QR code check-in system makes entry smooth and efficient. Attendees simply show their QR code at the entrance, and you can scan it using the Ticketrack mobile app.</p>
      
      <h2>Conclusion</h2>
      <p>Creating your first event on Ticketrack is just the beginning. As you gain experience, experiment with different pricing strategies, marketing approaches, and ticket types to optimize your success. Remember, every successful event organizer started with their first event – and with Ticketrack's tools and support, you're well-equipped for success.</p>
    `
  },
  '10-proven-strategies-sell-out-events-nigeria': {
    id: 2,
    title: '10 Proven Strategies to Sell Out Your Events in Nigeria',
    slug: '10-proven-strategies-sell-out-events-nigeria',
    excerpt: 'Discover the most effective marketing and pricing strategies used by successful Nigerian event organizers to consistently sell out their events.',
    author: 'Ticketrack Team',
    date: '2024-01-10',
    readTime: '15 min read',
    category: 'Marketing',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&h=600&fit=crop',
    tags: ['sell out', 'nigeria', 'marketing', 'event promotion'],
    content: `
      <h2>Introduction</h2>
      <p>Selling out events in Nigeria's competitive entertainment and events market requires a strategic approach. Nigerian audiences are discerning, value-conscious, and heavily influenced by social media and peer recommendations. This guide reveals 10 proven strategies that successful Nigerian event organizers use to consistently sell out their events.</p>
      
      <h2>1. Leverage Social Media Marketing Effectively</h2>
      <p>In Nigeria, social media is king. With millions of active users on Instagram, Twitter, Facebook, and TikTok, your social media strategy can make or break your event.</p>
      
      <h3>Instagram Strategy</h3>
      <p>Instagram is particularly powerful in Nigeria. Use these tactics:</p>
      <ul>
        <li><strong>Visual Storytelling:</strong> Post high-quality images and videos of your venue, performers, or past events</li>
        <li><strong>Instagram Stories:</strong> Use countdown stickers, polls, and Q&A features to engage your audience</li>
        <li><strong>Influencer Partnerships:</strong> Collaborate with Nigerian influencers who align with your event's audience</li>
        <li><strong>Hashtag Strategy:</strong> Use location-based hashtags like #LagosEvents, #AbujaLife, or #PHEvents to reach local audiences</li>
      </ul>
      
      <h3>Twitter Engagement</h3>
      <p>Twitter is where conversations happen in Nigeria:</p>
      <ul>
        <li>Engage with trending topics related to your event type</li>
        <li>Host Twitter Spaces to discuss your event theme</li>
        <li>Retweet and engage with attendees who mention your event</li>
        <li>Use Twitter polls to generate interest and gather feedback</li>
      </ul>
      
      <h2>2. Early Bird Pricing with Nigerian Payment Methods</h2>
      <p>Nigerians appreciate value. Early bird pricing creates urgency and rewards early supporters:</p>
      <ul>
        <li>Offer 30-40% discounts for tickets purchased 4-6 weeks before the event</li>
        <li>Accept multiple payment methods including bank transfers, USSD, and mobile money via Ticketrack's Paystack integration</li>
        <li>Create tiered pricing: Early Bird → Regular → Last Minute (highest price)</li>
        <li>Use scarcity messaging: "Only 50 early bird tickets left!"</li>
      </ul>
      
      <h2>3. Partner with Local Influencers and Celebrities</h2>
      <p>Nigerian audiences trust recommendations from influencers and celebrities. Partner strategically:</p>
      <ul>
        <li>Identify micro-influencers (10K-100K followers) in your event's niche</li>
        <li>Offer free tickets or VIP access in exchange for promotion</li>
        <li>Host influencer meet-and-greets to attract their followers</li>
        <li>Work with event promoters who have established networks</li>
      </ul>
      
      <h2>4. Create FOMO (Fear of Missing Out)</h2>
      <p>FOMO is a powerful psychological trigger in Nigerian culture:</p>
      <ul>
        <li>Share behind-the-scenes content as the event approaches</li>
        <li>Post photos and videos from sound checks and setup</li>
        <li>Share testimonials from past attendees</li>
        <li>Create countdown posts showing limited tickets remaining</li>
        <li>Host exclusive pre-event experiences for early ticket holders</li>
      </ul>
      
      <h2>5. Leverage WhatsApp and Telegram</h2>
      <p>WhatsApp is essential in Nigeria. Many successful organizers:</p>
      <ul>
        <li>Create WhatsApp groups for ticket holders</li>
        <li>Send regular updates and exclusive content via WhatsApp</li>
        <li>Use WhatsApp broadcast lists to announce ticket releases</li>
        <li>Enable Telegram channels for event updates</li>
      </ul>
      
      <h2>6. Local Media Partnerships</h2>
      <p>Traditional media still holds power in Nigeria:</p>
      <ul>
        <li>Partner with local radio stations for event promotion</li>
        <li>Get featured in Nigerian entertainment blogs and websites</li>
        <li>Work with event listing platforms popular in Nigeria</li>
        <li>Secure press coverage from major Nigerian publications</li>
      </ul>
      
      <h2>7. Strategic Venue Selection</h2>
      <p>Your venue choice can significantly impact sales:</p>
      <ul>
        <li>Choose venues in accessible, popular areas (Lagos Island, Victoria Island, Lekki, Ikeja in Lagos)</li>
        <li>Ensure good parking availability</li>
        <li>Consider public transportation access</li>
        <li>Select venues with good reputation and facilities</li>
        <li>Smaller venues can create scarcity – a 200-capacity venue can sell out faster than 2000</li>
      </ul>
      
      <h2>8. Bundle Tickets with Value-Adds</h2>
      <p>Nigerians love getting value. Create attractive bundles:</p>
      <ul>
        <li>VIP tickets with free drinks, parking, or merchandise</li>
        <li>Couple tickets at discounted rates</li>
        <li>Group packages for friends and families</li>
        <li>Bundle event tickets with partner products or services</li>
      </ul>
      
      <h2>9. Community Building Before the Event</h2>
      <p>Build a community around your event brand:</p>
      <ul>
        <li>Create a Facebook group for your event series</li>
        <li>Host pre-event meetups or networking sessions</li>
        <li>Encourage user-generated content with event-specific hashtags</li>
        <li>Build an email list for future events</li>
        <li>Offer loyalty rewards for repeat attendees</li>
      </ul>
      
      <h2>10. Post-Event Momentum for Future Events</h2>
      <p>Selling out isn't just about one event – it's about building a sustainable brand:</p>
      <ul>
        <li>Capture photos and videos during the event</li>
        <li>Share highlights immediately after the event</li>
        <li>Collect feedback and testimonials</li>
        <li>Announce your next event during the current one</li>
        <li>Create a mailing list for future events</li>
      </ul>
      
      <h2>Nigerian-Specific Considerations</h2>
      <p>Understanding the Nigerian market is crucial:</p>
      <ul>
        <li><strong>Timing:</strong> Avoid events during major holidays or competing events. Friday and Saturday nights work best</li>
        <li><strong>Pricing:</strong> Research local pricing norms. Nigerians are price-sensitive but will pay for quality</li>
        <li><strong>Language:</strong> Mix English with Nigerian Pidgin in your marketing for broader appeal</li>
        <li><strong>Cultural Sensitivity:</strong> Respect Nigerian cultural norms and values</li>
        <li><strong>Reliability:</strong> Build trust by delivering on promises – Nigerian audiences remember bad experiences</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Selling out events in Nigeria requires a combination of strategic marketing, understanding local preferences, and building trust with your audience. By implementing these 10 strategies and consistently delivering quality experiences, you'll build a loyal following that ensures your events sell out consistently. Remember, success in Nigeria's events market is about building relationships and delivering value – do both well, and sellouts will follow.</p>
    `
  },
  'mastering-event-pricing-maximum-revenue': {
    id: 3,
    title: 'Mastering Event Pricing: How to Price Your Tickets for Maximum Revenue',
    slug: 'mastering-event-pricing-maximum-revenue',
    excerpt: 'Learn the psychology of pricing, dynamic pricing strategies, and how to find the sweet spot that maximizes both attendance and revenue.',
    author: 'Ticketrack Team',
    date: '2024-01-08',
    readTime: '10 min read',
    category: 'Revenue',
    image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=1200&h=600&fit=crop',
    tags: ['pricing', 'revenue', 'strategy'],
    content: `
      <h2>Introduction</h2>
      <p>Pricing is one of the most critical decisions you'll make as an event organizer. Get it right, and you'll maximize revenue while maintaining strong attendance. Get it wrong, and you might struggle with sales or leave money on the table. This guide will help you master event pricing strategies.</p>
      
      <h2>Understanding Pricing Psychology</h2>
      <p>Before setting prices, understand how people perceive value:</p>
      
      <h3>The Power of 9</h3>
      <p>Pricing tickets at ₦9,999 instead of ₦10,000 can increase sales. The number 9 is psychologically more appealing and feels like a better deal.</p>
      
      <h3>Anchoring Effect</h3>
      <p>Show your highest-priced VIP option first. This "anchors" the price perception, making regular tickets seem more affordable in comparison.</p>
      
      <h3>Value Perception</h3>
      <p>People don't buy tickets – they buy experiences. Frame your pricing around the value attendees will receive, not just the cost.</p>
      
      <h2>Dynamic Pricing Strategies</h2>
      <p>Dynamic pricing allows you to adjust prices based on demand, timing, and other factors:</p>
      
      <h3>Tiered Pricing</h3>
      <p>Create multiple pricing tiers:</p>
      <ul>
        <li><strong>Early Bird (Week 1-2):</strong> 30-40% discount</li>
        <li><strong>Regular (Week 3-6):</strong> Standard pricing</li>
        <li><strong>Late (Week 7+):</strong> 10-15% premium</li>
        <li><strong>Last Minute:</strong> Highest price, creates urgency</li>
      </ul>
      
      <h3>Demand-Based Pricing</h3>
      <p>Increase prices as tickets sell out. When you reach 70% capacity, raise prices by 10-20%. At 90%, raise again. This maximizes revenue from late buyers while rewarding early supporters.</p>
      
      <h2>Cost Analysis and Revenue Goals</h2>
      <p>Before setting prices, calculate your costs:</p>
      <ul>
        <li>Venue rental</li>
        <li>Performers or speakers fees</li>
        <li>Marketing expenses</li>
        <li>Equipment and production</li>
        <li>Staffing costs</li>
        <li>Catering (if applicable)</li>
        <li>Insurance and permits</li>
        <li>Payment processing fees</li>
      </ul>
      
      <p>Set your revenue goal and work backwards. If you need ₦5,000,000 in revenue and expect 500 attendees, your average ticket price should be ₦10,000. Create pricing tiers to achieve this average.</p>
      
      <h2>Market Research</h2>
      <p>Research similar events in your market:</p>
      <ul>
        <li>What are competitors charging?</li>
        <li>What's included in their ticket prices?</li>
        <li>How successful are they at those price points?</li>
        <li>What's the price range in your market?</li>
      </ul>
      
      <p>Use this research to position your pricing competitively while ensuring profitability.</p>
      
      <h2>Value-Based Pricing</h2>
      <p>Price based on the value you provide, not just your costs:</p>
      <ul>
        <li>What unique experience are you offering?</li>
        <li>What's the perceived value of meeting your speakers or performers?</li>
        <li>What exclusive content or experiences are included?</li>
        <li>What's the social value (networking, community)?</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Effective pricing is a balance between maximizing revenue and ensuring accessibility. Test different pricing strategies, monitor sales data, and adjust accordingly. Remember, pricing is not set in stone – you can adjust as you learn what works best for your audience.</p>
    `
  },
  'building-event-brand-guide-nigerian-organizers': {
    id: 4,
    title: 'Building Your Event Brand: A Guide for Nigerian Event Organizers',
    slug: 'building-event-brand-guide-nigerian-organizers',
    excerpt: 'Establish a strong event brand that resonates with your Nigerian audience. Learn branding strategies that work in the local market.',
    author: 'Ticketrack Team',
    date: '2024-01-05',
    readTime: '11 min read',
    category: 'Branding',
    image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=1200&h=600&fit=crop',
    tags: ['branding', 'nigeria', 'event organizer', 'brand identity'],
    content: `
      <h2>Introduction</h2>
      <p>In Nigeria's competitive events market, a strong brand is what sets successful organizers apart. Your brand is more than just a logo or name – it's the entire experience attendees associate with your events. This guide will help you build a compelling brand that resonates with Nigerian audiences.</p>
      
      <h2>Understanding Your Audience</h2>
      <p>Before building your brand, deeply understand your target audience:</p>
      <ul>
        <li>What are their interests and values?</li>
        <li>What other brands do they love?</li>
        <li>What cultural elements resonate with them?</li>
        <li>What language do they speak? (English, Pidgin, local languages)</li>
        <li>What platforms do they use most?</li>
      </ul>
      
      <h2>Creating Your Brand Identity</h2>
      
      <h3>Brand Name</h3>
      <p>Choose a name that:</p>
      <ul>
        <li>Is memorable and easy to pronounce</li>
        <li>Reflects your event's personality</li>
        <li>Works well in both English and Nigerian contexts</li>
        <li>Is available as a social media handle</li>
        <li>Has a story behind it</li>
      </ul>
      
      <h3>Visual Identity</h3>
      <p>Your visual identity includes:</p>
      <ul>
        <li><strong>Logo:</strong> Simple, scalable, recognizable</li>
        <li><strong>Color Palette:</strong> Choose colors that resonate with Nigerian culture while standing out</li>
        <li><strong>Typography:</strong> Use fonts that reflect your brand's personality</li>
        <li><strong>Imagery Style:</strong> Consistent photography and design style</li>
      </ul>
      
      <h2>Brand Storytelling</h2>
      <p>Nigerians love stories. Craft a compelling brand story:</p>
      <ul>
        <li>Why did you start organizing events?</li>
        <li>What's your mission or vision?</li>
        <li>What makes your events unique?</li>
        <li>How do you serve your community?</li>
      </ul>
      
      <p>Share this story consistently across all touchpoints – your website, social media, event descriptions, and in-person interactions.</p>
      
      <h2>Building Brand Consistency</h2>
      <p>Consistency builds trust and recognition:</p>
      <ul>
        <li>Use the same visual elements across all platforms</li>
        <li>Maintain consistent tone of voice in communications</li>
        <li>Deliver consistent event experiences</li>
        <li>Keep messaging aligned with brand values</li>
      </ul>
      
      <h2>Nigerian Cultural Considerations</h2>
      <p>When building your brand in Nigeria:</p>
      <ul>
        <li>Respect cultural values and traditions</li>
        <li>Celebrate Nigerian achievements and talent</li>
        <li>Incorporate local elements authentically</li>
        <li>Build trust through transparency and reliability</li>
        <li>Engage with Nigerian communities genuinely</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Building a strong brand takes time, but it's the foundation for long-term success. Focus on delivering consistent value, telling your story authentically, and engaging genuinely with your Nigerian audience. A strong brand will make every subsequent event easier to promote and sell.</p>
    `
  },
  'social-media-marketing-events-nigeria': {
    id: 5,
    title: 'Social Media Marketing for Events: Reaching Your Audience in Nigeria',
    slug: 'social-media-marketing-events-nigeria',
    excerpt: 'Master Instagram, Twitter, Facebook, and TikTok marketing to promote your events effectively in the Nigerian market.',
    author: 'Ticketrack Team',
    date: '2024-01-03',
    readTime: '14 min read',
    category: 'Marketing',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=600&fit=crop',
    tags: ['social media', 'marketing', 'nigeria', 'instagram', 'promotion'],
    content: `
      <h2>Introduction</h2>
      <p>With over 100 million internet users in Nigeria, social media is the most powerful tool for event promotion. This guide will help you master social media marketing specifically for the Nigerian market.</p>
      
      <h2>Instagram Marketing</h2>
      <p>Instagram is the most important platform for events in Nigeria:</p>
      
      <h3>Content Strategy</h3>
      <ul>
        <li>Post high-quality visuals daily</li>
        <li>Use Instagram Stories for behind-the-scenes content</li>
        <li>Create Instagram Reels showcasing your event</li>
        <li>Use location tags to reach local audiences</li>
        <li>Collaborate with Nigerian influencers</li>
      </ul>
      
      <h3>Hashtag Strategy</h3>
      <p>Use a mix of:</p>
      <ul>
        <li>Event-specific hashtags (#YourEventName2024)</li>
        <li>Location hashtags (#LagosEvents, #AbujaLife)</li>
        <li>Category hashtags (#LagosNightlife, #LagosConcert)</li>
        <li>Trending hashtags when relevant</li>
      </ul>
      
      <h2>Twitter Marketing</h2>
      <p>Twitter is where conversations happen:</p>
      <ul>
        <li>Engage with trending topics</li>
        <li>Host Twitter Spaces before events</li>
        <li>Use polls to engage your audience</li>
        <li>Retweet and engage with mentions</li>
        <li>Thread important announcements</li>
      </ul>
      
      <h2>Facebook Marketing</h2>
      <p>Facebook remains important, especially for older demographics:</p>
      <ul>
        <li>Create Facebook events and invite attendees</li>
        <li>Use Facebook Groups to build community</li>
        <li>Run targeted Facebook ads</li>
        <li>Post in relevant Facebook groups</li>
      </ul>
      
      <h2>TikTok Marketing</h2>
      <p>TikTok is growing rapidly in Nigeria:</p>
      <ul>
        <li>Create short, engaging videos</li>
        <li>Use trending sounds and challenges</li>
        <li>Partner with TikTok creators</li>
        <li>Show behind-the-scenes moments</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Effective social media marketing requires consistency, engagement, and understanding your platform-specific audience. Focus on building genuine relationships with your followers, and they'll become your best promoters.</p>
    `
  },
  'ultimate-checklist-host-successful-event': {
    id: 6,
    title: 'The Ultimate Checklist: Everything You Need to Host a Successful Event',
    slug: 'ultimate-checklist-host-successful-event',
    excerpt: 'A comprehensive pre-event, day-of, and post-event checklist to ensure nothing falls through the cracks.',
    author: 'Ticketrack Team',
    date: '2024-01-01',
    readTime: '13 min read',
    category: 'Planning',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
    tags: ['checklist', 'planning', 'event management'],
    content: `
      <h2>Introduction</h2>
      <p>Successful events don't happen by accident – they're the result of meticulous planning and execution. This comprehensive checklist will ensure you don't miss any critical steps.</p>
      
      <h2>Pre-Event Checklist (4-6 Weeks Before)</h2>
      <ul>
        <li>✓ Define event objectives and goals</li>
        <li>✓ Set budget and track expenses</li>
        <li>✓ Book venue and confirm details</li>
        <li>✓ Create event on Ticketrack</li>
        <li>✓ Set up ticket types and pricing</li>
        <li>✓ Design event graphics and marketing materials</li>
        <li>✓ Launch marketing campaign</li>
        <li>✓ Secure performers, speakers, or entertainment</li>
        <li>✓ Arrange catering (if needed)</li>
        <li>✓ Book equipment and technical requirements</li>
        <li>✓ Obtain necessary permits and licenses</li>
        <li>✓ Purchase event insurance</li>
      </ul>
      
      <h2>Week of Event</h2>
      <ul>
        <li>✓ Send reminder emails to attendees</li>
        <li>✓ Confirm all vendors and suppliers</li>
        <li>✓ Finalize attendee count</li>
        <li>✓ Prepare check-in system and QR codes</li>
        <li>✓ Brief staff and volunteers</li>
        <li>✓ Do a final venue walkthrough</li>
        <li>✓ Test all equipment</li>
        <li>✓ Prepare emergency contacts list</li>
      </ul>
      
      <h2>Day of Event</h2>
      <ul>
        <li>✓ Arrive early for setup</li>
        <li>✓ Test all technical equipment</li>
        <li>✓ Brief security and staff</li>
        <li>✓ Set up check-in stations</li>
        <li>✓ Ensure signage is visible</li>
        <li>✓ Confirm catering timeline</li>
        <li>✓ Monitor social media mentions</li>
        <li>✓ Be ready for early arrivals</li>
      </ul>
      
      <h2>Post-Event</h2>
      <ul>
        <li>✓ Send thank you emails to attendees</li>
        <li>✓ Collect feedback and testimonials</li>
        <li>✓ Pay all vendors and suppliers</li>
        <li>✓ Analyze sales data and metrics</li>
        <li>✓ Share event photos and highlights</li>
        <li>✓ Announce next event (if applicable)</li>
        <li>✓ Update your database with new contacts</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Following a comprehensive checklist ensures nothing is forgotten and your event runs smoothly. Adapt this checklist to your specific event type and needs.</p>
    `
  },
  'early-bird-pricing-drive-sales-create-urgency': {
    id: 7,
    title: 'Early Bird Pricing: How to Drive Initial Sales and Create Urgency',
    slug: 'early-bird-pricing-drive-sales-create-urgency',
    excerpt: 'Learn how early bird pricing can boost your ticket sales, create FOMO, and maximize revenue with strategic pricing tiers.',
    author: 'Ticketrack Team',
    date: '2023-12-28',
    readTime: '9 min read',
    category: 'Revenue',
    image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200&h=600&fit=crop',
    tags: ['pricing', 'early bird', 'sales strategy', 'FOMO'],
    content: `
      <h2>Introduction</h2>
      <p>Early bird pricing is one of the most effective strategies for driving initial ticket sales and creating momentum for your event. This guide explains how to implement it successfully.</p>
      
      <h2>Benefits of Early Bird Pricing</h2>
      <ul>
        <li><strong>Generate Early Cash Flow:</strong> Get revenue before major expenses hit</li>
        <li><strong>Gauge Demand:</strong> Understand early interest in your event</li>
        <li><strong>Create Urgency:</strong> Encourage quick purchasing decisions</li>
        <li><strong>Build Momentum:</strong> Early sales create social proof</li>
        <li><strong>Reward Loyal Fans:</strong> Give best prices to your biggest supporters</li>
      </ul>
      
      <h2>Setting Early Bird Discounts</h2>
      <p>Typical early bird discounts range from 25-40%:</p>
      <ul>
        <li><strong>25-30%:</strong> For established events with strong demand</li>
        <li><strong>30-35%:</strong> For new events needing to build awareness</li>
        <li><strong>35-40%:</strong> For events in competitive markets</li>
      </ul>
      
      <h2>Timing Your Early Bird Period</h2>
      <p>Set early bird pricing for 2-4 weeks after ticket launch:</p>
      <ul>
        <li>Too short: Miss potential sales</li>
        <li>Too long: Lose urgency and perception of value</li>
        <li>Sweet spot: 3-4 weeks for most events</li>
      </ul>
      
      <h2>Creating Scarcity</h2>
      <p>Limit early bird ticket quantities:</p>
      <ul>
        <li>Cap at 20-30% of total capacity</li>
        <li>Update countdown on website: "Only 47 early bird tickets left!"</li>
        <li>Send targeted emails when count drops</li>
      </ul>
      
      <h2>Marketing Early Bird Pricing</h2>
      <p>Promote your early bird pricing heavily:</p>
      <ul>
        <li>Announce launch with clear deadline</li>
        <li>Create countdown timers on your event page</li>
        <li>Send reminder emails 3 days and 1 day before deadline</li>
        <li>Use social media to create urgency</li>
        <li>Highlight the savings amount clearly</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Early bird pricing, when executed well, can significantly boost your initial sales and create momentum that carries through to your event. The key is finding the right discount level and timing for your specific market and event type.</p>
    `
  },
  'networking-partnerships-growing-event-organizer-network-nigeria': {
    id: 8,
    title: 'Networking and Partnerships: Growing Your Event Organizer Network in Nigeria',
    slug: 'networking-partnerships-growing-event-organizer-network-nigeria',
    excerpt: 'Build valuable partnerships with venues, vendors, influencers, and other organizers to grow your event business in Nigeria.',
    author: 'Ticketrack Team',
    date: '2023-12-25',
    readTime: '12 min read',
    category: 'Growth',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=600&fit=crop',
    tags: ['networking', 'partnerships', 'nigeria', 'business growth'],
    content: `
      <h2>Introduction</h2>
      <p>Building strong networks and partnerships is essential for growing your event business in Nigeria. This guide shows you how to build valuable relationships that benefit your events.</p>
      
      <h2>Building Relationships with Venues</h2>
      <p>Strong venue relationships lead to better rates and priority booking:</p>
      <ul>
        <li>Visit venues in person before booking</li>
        <li>Negotiate package deals for multiple events</li>
        <li>Refer other organizers to build goodwill</li>
        <li>Provide testimonials and reviews</li>
        <li>Consider long-term contracts for regular events</li>
      </ul>
      
      <h2>Vendor Partnerships</h2>
      <p>Reliable vendors are crucial for event success:</p>
      <ul>
        <li>Build relationships with caterers, decorators, and technical suppliers</li>
        <li>Negotiate bulk discounts for regular business</li>
        <li>Create preferred vendor lists</li>
        <li>Support local Nigerian businesses</li>
      </ul>
      
      <h2>Collaborating with Other Organizers</h2>
      <p>Partner with complementary organizers:</p>
      <ul>
        <li>Co-host events to share costs and audiences</li>
        <li>Cross-promote events in similar niches</li>
        <li>Share resources and knowledge</li>
        <li>Attend other organizers' events to build relationships</li>
      </ul>
      
      <h2>Influencer and Media Partnerships</h2>
      <p>Strategic partnerships amplify your reach:</p>
      <ul>
        <li>Build genuine relationships with influencers</li>
        <li>Offer value beyond just free tickets</li>
        <li>Partner with media outlets for coverage</li>
        <li>Create win-win collaborations</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Networking and partnerships take time to develop but are invaluable for long-term growth. Focus on building genuine relationships based on mutual value, and your network will become one of your strongest assets.</p>
    `
  },
  'using-analytics-improve-events-data-driven-decisions': {
    id: 9,
    title: 'Using Analytics to Improve Your Events: Making Data-Driven Decisions',
    slug: 'using-analytics-improve-events-data-driven-decisions',
    excerpt: 'Leverage Ticketrack analytics to understand your audience, optimize marketing spend, and improve event ROI.',
    author: 'Ticketrack Team',
    date: '2023-12-22',
    readTime: '10 min read',
    category: 'Analytics',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop',
    tags: ['analytics', 'data', 'ROI', 'optimization'],
    content: `
      <h2>Introduction</h2>
      <p>Data-driven decisions separate successful event organizers from the rest. Ticketrack's analytics tools provide insights that help you optimize every aspect of your events.</p>
      
      <h2>Key Metrics to Track</h2>
      <ul>
        <li><strong>Ticket Sales:</strong> Track sales velocity and trends</li>
        <li><strong>Revenue:</strong> Monitor total and average ticket value</li>
        <li><strong>Demographics:</strong> Understand your audience composition</li>
        <li><strong>Marketing Channels:</strong> See which channels drive sales</li>
        <li><strong>Check-in Rates:</strong> Track actual attendance vs. sales</li>
      </ul>
      
      <h2>Using Data to Improve</h2>
      <p>Use analytics to:</p>
      <ul>
        <li>Identify your best-selling ticket types</li>
        <li>Optimize pricing based on sales velocity</li>
        <li>Adjust marketing spend to high-performing channels</li>
        <li>Understand peak buying times</li>
        <li>Predict attendance for future planning</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Regularly reviewing analytics and acting on insights helps you continuously improve your events and maximize ROI. Make data review a regular part of your event planning process.</p>
    `
  },
  'scaling-event-business-first-event-sell-out-success': {
    id: 10,
    title: 'Scaling Your Event Business: From First Event to Sell-Out Success',
    slug: 'scaling-event-business-first-event-sell-out-success',
    excerpt: 'Learn how successful Nigerian event organizers scaled from their first event to hosting sell-out shows with thousands of attendees.',
    author: 'Ticketrack Team',
    date: '2023-12-20',
    readTime: '16 min read',
    category: 'Growth',
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop',
    tags: ['scaling', 'growth', 'nigeria', 'sell out', 'business'],
    content: `
      <h2>Introduction</h2>
      <p>Every successful event business started with a single event. This guide shares the strategies used by Nigerian event organizers who've scaled from their first event to hosting sold-out shows with thousands of attendees.</p>
      
      <h2>Stage 1: Your First Event (0-100 Attendees)</h2>
      <p>Focus on delivering an exceptional experience:</p>
      <ul>
        <li>Start small and manageable</li>
        <li>Focus on quality over quantity</li>
        <li>Collect feedback from every attendee</li>
        <li>Build an email list from day one</li>
        <li>Capture photos and videos</li>
        <li>Ask for testimonials and reviews</li>
      </ul>
      
      <h2>Stage 2: Building Momentum (100-500 Attendees)</h2>
      <p>Use your early successes to grow:</p>
      <ul>
        <li>Establish a consistent event series</li>
        <li>Build your brand and visual identity</li>
        <li>Invest in professional marketing materials</li>
        <li>Build relationships with venues and vendors</li>
        <li>Expand your team with reliable staff</li>
        <li>Develop a promoter network</li>
      </ul>
      
      <h2>Stage 3: Scaling Up (500-2000 Attendees)</h2>
      <p>Systematize your operations:</p>
      <ul>
        <li>Create standard operating procedures</li>
        <li>Build a reliable team and delegate</li>
        <li>Invest in better venues and production</li>
        <li>Develop partnerships with major brands</li>
        <li>Expand your marketing budget</li>
        <li>Consider multiple event types or locations</li>
      </ul>
      
      <h2>Stage 4: Sell-Out Success (2000+ Attendees)</h2>
      <p>At this stage, focus on consistency and innovation:</p>
      <ul>
        <li>Maintain quality as you scale</li>
        <li>Invest in customer experience</li>
        <li>Build a strong brand that sells itself</li>
        <li>Explore new markets and opportunities</li>
        <li>Mentor other organizers</li>
        <li>Give back to your community</li>
      </ul>
      
      <h2>Lessons from Successful Nigerian Organizers</h2>
      <p>Common strategies among sell-out organizers:</p>
      <ul>
        <li><strong>Consistency:</strong> Regular events build trust and loyalty</li>
        <li><strong>Community:</strong> Build a tribe around your events</li>
        <li><strong>Quality:</strong> Never compromise on attendee experience</li>
        <li><strong>Adaptation:</strong> Evolve based on feedback and market changes</li>
        <li><strong>Patience:</strong> Growth takes time – focus on gradual improvement</li>
      </ul>
      
      <h2>Conclusion</h2>
      <p>Scaling an event business is a marathon, not a sprint. Focus on delivering exceptional value at each stage, building genuine relationships, and continuously improving. With dedication and the right strategies, your first event can become the foundation of a thriving, sell-out event business.</p>
    `
  }
}

export function WebBlogPost() {
  const { slug } = useParams()
  const navigate = useNavigate()
  
  const post = blogPosts[slug]

  if (!post) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Post Not Found</h1>
          <p className="text-[#0F0F0F]/60 mb-6">The blog post you're looking for doesn't exist.</p>
          <Link to="/blog" className="inline-flex items-center gap-2 bg-[#2969FF] text-white px-6 py-3 rounded-xl hover:bg-[#1e4fd6] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Error sharing:', err)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  // Get related posts (same category, different post)
  const relatedPosts = Object.values(blogPosts)
    .filter(p => p.id !== post.id && p.category === post.category)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <div className="bg-white border-b border-[#0F0F0F]/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-2 text-[#2969FF] hover:text-[#1e4fd6] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Blog
          </Link>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-96 overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-white">
          <div className="mb-4">
            <span className="inline-block bg-[#2969FF] text-white text-sm font-semibold px-3 py-1 rounded-full mb-4">
              {post.category}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </span>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div 
          className="prose prose-lg max-w-none prose-headings:text-[#0F0F0F] prose-p:text-[#0F0F0F]/80 prose-li:text-[#0F0F0F]/80 prose-strong:text-[#0F0F0F] prose-a:text-[#2969FF] prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote', 'span', 'pre', 'code'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class'] }) }}
        />

        {/* Tags */}
        <div className="mt-12 pt-8 border-t border-[#0F0F0F]/10">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 bg-[#F4F6FA] text-[#0F0F0F]/60 px-3 py-1 rounded-full text-sm"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="bg-white border-t border-[#0F0F0F]/10 py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/blog/${relatedPost.slug}`}
                  className="group"
                >
                  <Card className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={relatedPost.image}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <CardContent className="p-5">
                      <h3 className="text-lg font-bold text-[#0F0F0F] mb-2 group-hover:text-[#2969FF] transition-colors line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-[#0F0F0F]/60 text-sm line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-sm text-[#2969FF] font-medium">
                        Read More
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-[#2969FF] to-[#1e4fd6] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Create Your Next Event?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Put these strategies into practice with Ticketrack's powerful event management tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/organizer"
              className="inline-flex items-center justify-center bg-white text-[#2969FF] px-8 py-4 rounded-xl font-semibold hover:bg-white/90 transition-colors"
            >
              Create Your Event
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center justify-center bg-white/10 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-colors"
            >
              Read More Articles
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default WebBlogPost
