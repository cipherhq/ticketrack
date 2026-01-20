import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

/**
 * Logo component - Always redirects to homepage (/)
 * @param {string} className - Tailwind classes for logo size (default: 'h-8')
 * @param {boolean} showText - Whether to show "Ticketrack" text next to logo
 * @param {string} variant - 'light' for dark backgrounds, 'dark' for light backgrounds (default: 'dark')
 */
export function Logo({ className = 'h-8', showText = false, variant = 'dark' }) {
  // Always redirect to homepage
  const logoPath = '/';
  
  // Force showText to false - logo should never show text
  const shouldShowText = false;
  
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
  
  return (
    <Link to={logoPath} className="flex items-center hover:opacity-80 transition-opacity">
      <div 
        className="relative overflow-hidden flex items-center justify-center"
        style={{ 
          width: height, 
          height: height,
        }}
      >
        <img 
          src={brand.logo} 
          alt={brand.name} 
          className="object-cover"
          style={{ 
            width: 'auto',
            height: height,
            objectPosition: 'left center',
            // Crop to show only the left portion (icon part) of the logo
            // The logo image has text on the right, so we crop from the right
            clipPath: 'inset(0 60% 0 0)',
            marginLeft: '-40%'
          }}
        />
      </div>
      {shouldShowText && showText && (
        <span className="text-xl font-semibold">{brand.name}</span>
      )}
    </Link>
  );
}
