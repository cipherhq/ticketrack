import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
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
  const [inputValue, setInputValue] = useState(value || '');

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Load Google Maps script
  useEffect(() => {
    const loadGoogleMaps = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        console.error('Google Maps API key is missing');
        setIsLoading(false);
        return;
      }

      // Check if Google Maps is already loaded
      if (window.google?.maps?.places?.Autocomplete) {
        setIsLoaded(true);
        setIsLoading(false);
        return;
      }

      // Check if script is already loading
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // Wait for it to load
        const checkLoaded = setInterval(() => {
          if (window.google?.maps?.places?.Autocomplete) {
            clearInterval(checkLoaded);
            setIsLoaded(true);
            setIsLoading(false);
          }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => clearInterval(checkLoaded), 10000);
        return;
      }

      // Load Google Maps script with Places library
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.google?.maps?.places?.Autocomplete) {
          setIsLoaded(true);
        }
        setIsLoading(false);
      };

      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Initialize Autocomplete when loaded and input is ready
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        fields: ['formatted_address', 'name', 'place_id', 'geometry', 'address_components'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        console.log('[AddressAutocomplete] Place selected:', place);

        if (!place.formatted_address && !place.name) {
          console.log('[AddressAutocomplete] No place data, user may have pressed enter without selecting');
          return;
        }

        const address = place.formatted_address || place.name || '';

        const placeData = {
          address: address,
          name: place.name || '',
          placeId: place.place_id || '',
          lat: place.geometry?.location?.lat() || null,
          lng: place.geometry?.location?.lng() || null,
          city: '',
          country: '',
          googleMapLink: '',
        };

        // Extract city and country from address components
        if (place.address_components) {
          place.address_components.forEach(component => {
            const types = component.types || [];
            if (types.includes('locality')) {
              placeData.city = component.long_name || '';
            }
            if (types.includes('administrative_area_level_1') && !placeData.city) {
              placeData.city = component.long_name || '';
            }
            if (types.includes('country')) {
              placeData.country = component.long_name || '';
            }
          });
        }

        // Generate Google Maps link
        if (placeData.lat && placeData.lng) {
          placeData.googleMapLink = `https://www.google.com/maps/search/?api=1&query=${placeData.lat},${placeData.lng}&query_place_id=${placeData.placeId}`;
        }

        console.log('[AddressAutocomplete] Calling callbacks with:', placeData);
        setInputValue(address);
        onChange?.(address);
        onPlaceSelect?.(placeData);
      });

      autocompleteRef.current = autocomplete;
      console.log('[AddressAutocomplete] Autocomplete initialized');
    } catch (error) {
      console.error('[AddressAutocomplete] Error initializing Autocomplete:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, onChange, onPlaceSelect]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  const clearInput = () => {
    setInputValue('');
    onChange?.('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <Input
          placeholder="Loading maps..."
          disabled
          className="h-12 rounded-xl bg-white border border-gray-200 pl-10"
        />
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="h-12 rounded-xl bg-white border border-gray-200 pl-10 pr-10"
      />
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
      {inputValue && (
        <button
          type="button"
          onClick={clearInput}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
