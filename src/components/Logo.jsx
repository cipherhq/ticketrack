import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

export function Logo({ to = '/', className = 'h-8', showText = false }) {
  return (
    <Link to={to} className="flex items-center gap-2">
      <img 
        src={brand.logo} 
        alt={brand.name} 
        className={className}
      />
      {showText && (
        <span className="text-xl font-semibold">{brand.name}</span>
      )}
    </Link>
  );
}
