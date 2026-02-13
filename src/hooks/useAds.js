import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getCountryFromIP } from '@/utils/location';

export function useAds() {
  const [ads, setAds] = useState({ top: [], bottom: [], right: [], left: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAds() {
      try {
        const now = new Date().toISOString();

        // Fetch active, paid, approved ads within date range
        const { data, error } = await supabase
          .from('platform_adverts')
          .select('*')
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .lte('start_date', now)
          .gte('end_date', now)
          .order('created_at', { ascending: false });

        if (error || !data || cancelled) return;

        // Detect viewer country for geo-filtering
        let viewerCountry = null;
        try {
          viewerCountry = await getCountryFromIP();
        } catch {
          // Continue without geo-filtering
        }

        // Filter ads by target countries
        const filtered = data.filter(ad => {
          if (!ad.target_countries || ad.target_countries.length === 0) return true;
          if (!viewerCountry) return true;
          return ad.target_countries.includes(viewerCountry);
        });

        if (!cancelled) {
          setAds({
            top: filtered.filter(ad => ad.position === 'top'),
            bottom: filtered.filter(ad => ad.position === 'bottom'),
            right: filtered.filter(ad => ad.position === 'right' || ad.position === 'side'),
            left: filtered.filter(ad => ad.position === 'left' || ad.position === 'side'),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAds();
    return () => { cancelled = true; };
  }, []);

  return { ads, loading };
}
