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
  
  return (
    <Link to={logoPath} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <img 
        src={brand.logo} 
        alt={brand.name} 
        className={`${className} w-auto object-contain`}
      />
      {showText && (
        <span className="text-xl font-semibold">{brand.name}</span>
      )}
    </Link>
  );
}
