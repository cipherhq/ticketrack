import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { COUNTRIES } from '@/components/ui/phone-input';
import { supabase } from '@/lib/supabase';

export function CountryPickerDialog({ open, onComplete, userId }) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (countryCode) => {
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ country_code: countryCode })
        .eq('id', userId);
      onComplete(countryCode);
    } catch {
      // Allow retry
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md rounded-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#2969FF]/10 flex items-center justify-center mb-2">
            <Globe className="w-6 h-6 text-[#2969FF]" />
          </div>
          <DialogTitle className="text-xl">Where are you located?</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This helps us set the right currency for your payments. You can change this later in your profile settings.
          </DialogDescription>
        </DialogHeader>

        {saving ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 py-4">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleSelect(country.code)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-[#2969FF] hover:bg-[#2969FF]/5 transition-all"
              >
                <span className="text-4xl">{country.flag}</span>
                <span className="text-sm font-medium text-foreground">{country.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
