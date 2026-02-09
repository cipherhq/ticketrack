import { Check } from 'lucide-react';

const STEPS = [
  { id: 'package', label: 'Package' },
  { id: 'creative', label: 'Creative' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
];

export function AdStepIndicator({ currentStep = 0, completedSteps = new Set() }) {
  return (
    <div className="flex items-center justify-center w-full max-w-lg mx-auto py-4">
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(i);
        const isCurrent = i === currentStep;
        const isLineCompleted = completedSteps.has(i);

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Circle + Label */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-[#2969FF] text-white'
                    : isCurrent
                    ? 'border-2 border-[#2969FF] text-[#2969FF] bg-transparent'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`hidden sm:block text-xs mt-1.5 font-medium ${
                  isCompleted || isCurrent ? 'text-[#2969FF]' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  isLineCompleted ? 'bg-[#2969FF]' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
