import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

/**
 * Logo component - Always redirects to homepage (/)
 * Displays the complete Ticketrack logo (icon + text) optimized for all screen sizes
 * @param {string} className - Tailwind classes for logo size (default: 'h-8')
 * @param {boolean} showText - Deprecated: logo now always shows text as part of the image
 * @param {string} variant - 'light' for dark backgrounds, 'dark' for light backgrounds (default: 'dark')
 */
export function Logo({ className = 'h-8', showText = false, variant = 'dark' }) {
  // Always redirect to homepage
  const logoPath = '/';
  
  // Extract height from className (e.g., 'h-12' -> '48px', 'h-8' -> '32px')
  const getHeight = () => {
    const match = className.match(/h-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      return `${num * 4}px`; // Tailwind: h-8 = 32px, h-12 = 48px, etc.
    }
    return '32px'; // default
  };
  
  const height = getHeight();
  
  // Responsive max-width: smaller on mobile, larger on desktop
  // Using Tailwind responsive classes: max-w-[150px] sm:max-w-[180px] lg:max-w-[220px]
  
  return (
    <Link 
      to={logoPath} 
      className="flex items-center hover:opacity-80 transition-opacity flex-shrink-0"
      aria-label={`${brand.name} - Home`}
    >
      <img 
        src={brand.logo} 
        alt={brand.name}
        className={`${className} w-auto max-w-[150px] sm:max-w-[180px] lg:max-w-[220px] object-contain`}
        style={{ 
          height: height,
          width: 'auto',
        }}
        loading="eager"
        fetchPriority="high"
        onError={(e) => {
          // Fallback if image fails to load - show a simple "TR" text in a blue circle + text
          e.target.style.display = 'none';
          const parent = e.target.parentElement;
          if (parent && !parent.querySelector('.logo-fallback')) {
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'logo-fallback flex items-center gap-2';
            fallbackDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            `;
            
            // Icon fallback (blue circle with TR)
            const iconDiv = document.createElement('div');
            const size = parseInt(height);
            iconDiv.style.cssText = `
              width: ${height};
              height: ${height};
              background: #2969FF;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${Math.max(size * 0.4, 12)}px;
              flex-shrink: 0;
            `;
            iconDiv.textContent = 'TR';
            
            // Text fallback
            const textDiv = document.createElement('span');
            textDiv.style.cssText = `
              color: #2969FF;
              font-weight: bold;
              font-size: ${Math.max(size * 0.75, 16)}px;
              letter-spacing: -0.5px;
            `;
            textDiv.textContent = 'tickettrack';
            
            fallbackDiv.appendChild(iconDiv);
            fallbackDiv.appendChild(textDiv);
            parent.appendChild(fallbackDiv);
          }
        }}
      />
    </Link>
  );
}
