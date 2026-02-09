import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function AdBanner({ position, ad }) {
  const impressionTracked = useRef(false);
  const containerRef = useRef(null);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!ad?.id || impressionTracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          supabase.rpc('increment_ad_impressions', { ad_id: ad.id });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [ad?.id]);

  const handleClick = useCallback(async () => {
    if (!ad?.id) return;
    await supabase.rpc('increment_ad_clicks', { ad_id: ad.id });
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  }, [ad?.id, ad?.link_url]);

  if (!ad) return null;

  const isSidebar = position === 'right';

  return (
    <div
      ref={containerRef}
      className={
        isSidebar
          ? 'relative w-full'
          : 'relative max-w-[1200px] mx-auto my-8'
      }
    >
      <div className="absolute -top-5 right-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded z-10">
        Ad
      </div>
      <div
        onClick={handleClick}
        className={`bg-muted rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-shadow ${
          isSidebar
            ? 'w-full h-[250px]'
            : 'w-full h-[200px] md:h-[300px]'
        }`}
      >
        {ad.media_type === 'video' ? (
          <video
            src={ad.image_url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={ad.image_url}
            alt={ad.advertiser_name || 'Advertisement'}
            className="w-full h-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
