import type { CardComponentProps } from "nextstepjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SettingsTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div
      className={cn(
        "relative z-50 w-[320px] rounded-xl border bg-background p-4 shadow-lg",
        "animate-in fade-in zoom-in-95 duration-300"
      )}
    >
      {/* Arrow */}
      {arrow}

      {/* Progress indicator */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i + 1 === currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Icon and Title */}
      <div className="mb-3">
        <div className="mb-2 text-2xl">{step.icon}</div>
        <h3 className="font-semibold text-foreground">{step.title}</h3>
      </div>

      {/* Content */}
      <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
        {step.content}
      </p>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!isFirstStep && step.showControls && (
            <Button variant="ghost" size="sm" onClick={prevStep}>
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {step.showSkip && (
            <Button variant="ghost" size="sm" onClick={skipTour}>
              Skip
            </Button>
          )}
          {step.showControls && (
            <Button size="sm" onClick={nextStep}>
              {isLastStep ? "Finish" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
