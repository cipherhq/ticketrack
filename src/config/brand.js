// Centralized brand configuration
// Update here and it reflects everywhere

export const brand = {
  name: 'Ticketrack',
  tagline: "Your Gateway to Amazing Events",

  // Logo
  logo: '/ticketrackLogo.png',

  // URLs
  urls: {
    website: 'https://ticketrack.com',
    docs: 'https://docs.ticketrack.com',
    api: 'https://docs.ticketrack.com/api',
    webhooks: 'https://docs.ticketrack.com/webhooks',
    integrations: 'https://docs.ticketrack.com/integrations',
  },

  // Colors
  colors: {
    primary: '#2969FF',
    primaryDark: '#1e4fd6',
    secondary: '#0F0F0F',
    accent: '#F97316', // Orange for CTAs
  },

  // Social links
  social: {
    twitter: 'https://twitter.com/ticketrack',
    instagram: 'https://instagram.com/ticketrack',
    facebook: 'https://facebook.com/ticketrack',
  },

  // Contact emails
  emails: {
    support: 'support@ticketrack.com',
    privacy: 'privacy@ticketrack.com',
    legal: 'legal@ticketrack.com',
    safety: 'safety@ticketrack.com',
    careers: 'careers@ticketrack.com',
  },

  // Contact (legacy - use emails.support instead)
  contact: {
    email: 'support@ticketrack.com',
    phone: '+44 20 XXXX XXXX', // UK-based platform
  },

  // Stats (placeholder for now, can connect to DB later)
  stats: {
    eventsHosted: '10K+',
    ticketsSold: '500K+',
    countries: '6',
  }
};
