import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const ROTATION_INTERVAL = 60000; // 60 seconds per ad

export function AdBanner({ position, ads = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const trackedImpressions = useRef(new Set());
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  const currentAd = ads[currentIndex] || null;

  // Round-robin rotation
  useEffect(() => {
    if (ads.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % ads.length);
        setFading(false);
      }, 300); // fade-out duration
    }, ROTATION_INTERVAL);

    return () => clearInterval(timerRef.current);
  }, [ads.length]);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!currentAd?.id || trackedImpressions.current.has(currentAd.id)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !trackedImpressions.current.has(currentAd.id)) {
          trackedImpressions.current.add(currentAd.id);
          supabase.rpc('increment_ad_impressions', { ad_id: currentAd.id });
        }
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [currentAd?.id]);

  const handleClick = useCallback(async () => {
    if (!currentAd?.id) return;
    await supabase.rpc('increment_ad_clicks', { ad_id: currentAd.id });
    if (currentAd.link_url) {
      window.open(currentAd.link_url, '_blank', 'noopener,noreferrer');
    }
  }, [currentAd?.id, currentAd?.link_url]);

  if (!ads.length) return null;

  const isSidebar = position === 'right' || position === 'left';

  return (
    <div
      ref={containerRef}
      className={
        isSidebar
          ? 'relative w-full pt-4'
          : 'relative max-w-[1200px] mx-auto my-4 pt-4'
      }
    >
      <div className="absolute top-0 right-2 text-[10px] text-muted-foreground/60 px-1.5 py-0.5 z-10">
        Ad
      </div>
      <div
        onClick={handleClick}
        className={`bg-muted rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow ${
          isSidebar
            ? 'w-full h-[220px]'
            : 'w-full h-[120px] md:h-[180px]'
        }`}
      >
        <div
          className={`w-full h-full transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
        >
          {currentAd.media_type === 'video' ? (
            <video
              src={currentAd.image_url}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={currentAd.image_url}
              alt={currentAd.advertiser_name || 'Advertisement'}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>
      {/* Dots indicator for multiple ads */}
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); clearInterval(timerRef.current); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-foreground/60 w-4' : 'bg-foreground/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
