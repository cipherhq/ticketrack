import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from './input';

export function AddressAutocomplete({ 
  value, 
  onChange, 
  onPlaceSelect,
  placeholder = "Search for venue address...",
  className = "" 
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialize autocomplete
    // Restrict to US, UK, Canada, Nigeria, and Ghana
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: ['us', 'gb', 'ca', 'ng', 'gh'] }, // US, UK, Canada, Nigeria, Ghana
      fields: ['formatted_address', 'geometry', 'name', 'place_id', 'address_components'],
    });

    // Listen for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      
      if (place && place.formatted_address) {
        const placeData = {
          address: place.formatted_address,
          name: place.name || '',
          placeId: place.place_id,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          city: '',
          country: '',
          streetNumber: '',
          streetName: '',
          postalCode: '',
          subpremise: '', // For flat/unit numbers
        };

        // Extract detailed address components (important for UK addresses)
        if (place.address_components) {
          place.address_components.forEach(component => {
            if (component.types.includes('subpremise')) {
              placeData.subpremise = component.long_name; // Flat/Unit number
            }
            if (component.types.includes('street_number')) {
              placeData.streetNumber = component.long_name;
            }
            if (component.types.includes('route')) {
              placeData.streetName = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              placeData.postalCode = component.long_name;
            }
            if (component.types.includes('locality') || component.types.includes('postal_town')) {
              placeData.city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1') && !placeData.city) {
              placeData.city = component.long_name;
            }
            if (component.types.includes('country')) {
              placeData.country = component.long_name;
              placeData.countryCode = component.short_name;
            }
          });
        }

        // For UK addresses, build a more complete address if the venue name is just a postcode
        let displayAddress = place.formatted_address;
        
        // If country is UK and we have street details, ensure they're visible
        if (placeData.countryCode === 'GB' && placeData.streetNumber && placeData.streetName) {
          // Build address with house number first for UK
          const houseAddress = placeData.subpremise 
            ? `${placeData.subpremise}, ${placeData.streetNumber} ${placeData.streetName}`
            : `${placeData.streetNumber} ${placeData.streetName}`;
          
          // If formatted_address doesn't start with the house number, prepend it
          if (!displayAddress.startsWith(placeData.streetNumber) && !displayAddress.includes(houseAddress)) {
            displayAddress = `${houseAddress}, ${displayAddress}`;
          }
        }

        // Generate Google Maps link
        if (placeData.lat && placeData.lng) {
          placeData.googleMapLink = `https://www.google.com/maps/search/?api=1&query=${placeData.lat},${placeData.lng}&query_place_id=${placeData.placeId}`;
        }

        placeData.address = displayAddress;
        onChange(displayAddress);
        onPlaceSelect?.(placeData);
      }
    });

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange, onPlaceSelect]);

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <Input
          placeholder="Loading maps..."
          disabled
          className="h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10"
        />
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40 animate-spin" />
      </div>
    );
  }

  if (!isLoaded) {
    // Fallback to regular input if Google Maps fails to load
    return (
      <div className={`relative ${className}`}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10 pr-4 text-[#0F0F0F] placeholder:text-[#0F0F0F]/40 focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
      />
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
    </div>
  );
}
