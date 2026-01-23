import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from './input';

export function AddressAutocomplete({ 
  value, 
  onChange, 
  onPlaceSelect,
  placeholder = "Search for venue address...",
  className = "" 
}) {
  const containerRef = useRef(null);
  const autocompleteElementRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState(value || '');

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Load Google Maps script
  useEffect(() => {
    const loadGoogleMaps = async () => {
      // Check if Google Maps is already loaded with the new API
      if (window.google?.maps?.importLibrary) {
        try {
          await window.google.maps.importLibrary('places');
          setIsLoaded(true);
          setIsLoading(false);
          return;
        } catch (error) {
          console.error('Failed to load Places library:', error);
        }
      }

      // Check if script is already loading
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Wait for it to load
        const checkLoaded = setInterval(async () => {
          if (window.google?.maps?.importLibrary) {
            clearInterval(checkLoaded);
            try {
              await window.google.maps.importLibrary('places');
              setIsLoaded(true);
              setIsLoading(false);
            } catch (error) {
              console.error('Failed to load Places library:', error);
              setIsLoading(false);
            }
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkLoaded);
          if (!isLoaded) {
            setIsLoading(false);
          }
        }, 10000);
        return;
      }

      // Load Google Maps script with the new API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&loading=async`;
      script.async = true;
      script.defer = true;
      
      script.onload = async () => {
        try {
          await window.google.maps.importLibrary('places');
          setIsLoaded(true);
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to load Places library:', error);
          setIsLoading(false);
        }
      };
      
      script.onerror = () => {
        console.error('Failed to load Google Maps');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Handle place selection
  const handlePlaceSelect = useCallback(async (event) => {
    const { placePrediction } = event;
    
    if (!placePrediction) return;

    try {
      const place = placePrediction.toPlace();
      
      // Fetch the fields we need
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'id'],
      });

      const placeData = {
        address: place.formattedAddress || '',
        name: place.displayName || '',
        placeId: place.id || '',
        lat: place.location?.lat() || null,
        lng: place.location?.lng() || null,
        city: '',
        country: '',
      };

      // Extract city and country from address components
      if (place.addressComponents) {
        place.addressComponents.forEach(component => {
          const types = component.types || [];
          if (types.includes('locality')) {
            placeData.city = component.longText || component.long_name || '';
          }
          if (types.includes('administrative_area_level_1') && !placeData.city) {
            placeData.city = component.longText || component.long_name || '';
          }
          if (types.includes('country')) {
            placeData.country = component.longText || component.long_name || '';
          }
        });
      }

      // Generate Google Maps link
      if (placeData.lat && placeData.lng) {
        placeData.googleMapLink = `https://www.google.com/maps/search/?api=1&query=${placeData.lat},${placeData.lng}&query_place_id=${placeData.placeId}`;
      }

      setInputValue(place.formattedAddress || '');
      onChange(place.formattedAddress || '');
      onPlaceSelect?.(placeData);
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  }, [onChange, onPlaceSelect]);

  // Initialize the PlaceAutocompleteElement
  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    // Check if element already exists
    if (autocompleteElementRef.current) {
      return;
    }

    try {
      // Create the PlaceAutocompleteElement
      const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
        includedPrimaryTypes: ['establishment', 'geocode'],
        includedRegionCodes: ['ng', 'gh', 'ke', 'za', 'us', 'gb', 'ca', 'rw', 'tz', 'ug', 'eg', 'et', 'sn', 'ci', 'cm', 'ma'],
      });

      // Style the element
      placeAutocomplete.style.cssText = `
        width: 100%;
        --gmpac-input-height: 48px;
        --gmpac-input-background: #F4F6FA;
        --gmpac-input-border: none;
        --gmpac-input-border-radius: 12px;
        --gmpac-input-padding-left: 40px;
        --gmpac-input-padding-right: 16px;
        --gmpac-input-font-size: 14px;
        --gmpac-input-color: #0F0F0F;
        --gmpac-input-placeholder-color: rgba(15, 15, 15, 0.4);
        --gmpac-list-background: white;
        --gmpac-list-border-radius: 12px;
        --gmpac-list-item-selected-background: #F4F6FA;
      `;

      // Set placeholder
      placeAutocomplete.placeholder = placeholder;

      // Add event listener for place selection
      placeAutocomplete.addEventListener('gmp-select', handlePlaceSelect);

      // Clear the container and append the element
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(placeAutocomplete);
      
      autocompleteElementRef.current = placeAutocomplete;
    } catch (error) {
      console.error('Error initializing PlaceAutocompleteElement:', error);
    }

    return () => {
      if (autocompleteElementRef.current) {
        autocompleteElementRef.current.removeEventListener('gmp-select', handlePlaceSelect);
        autocompleteElementRef.current = null;
      }
    };
  }, [isLoaded, placeholder, handlePlaceSelect]);

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
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          className="h-12 rounded-xl bg-[#F4F6FA] border-0 pl-10"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full" />
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40 pointer-events-none z-10" />
    </div>
  );
}
