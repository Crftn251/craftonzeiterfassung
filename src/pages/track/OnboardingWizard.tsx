import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Building2, Briefcase } from "lucide-react";

type OnboardingWizardProps = {
  branches: readonly string[];
  activities: readonly string[];
  branch: string;
  activity: string;
  onChangeBranch: (value: string) => void;
  onChangeActivity: (value: string) => void;
};

export default function OnboardingWizard({
  branches,
  activities,
  branch,
  activity,
  onChangeBranch,
  onChangeActivity,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (branch && !activity) setStep(2);
    else setStep(1);
  }, [branch, activity]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-sm text-muted-foreground">Schritt {step} von 2</div>

      {step === 1 && (
        <div className="grid gap-4">
          <h2 className="text-xl font-medium">Wo arbeitest du?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {branches.map((b) => (
              <Button
                key={b}
                type="button"
                variant={branch === b ? "default" : "outline"}
                className="h-auto py-4 px-4 justify-center"
                aria-pressed={branch === b}
                onClick={() => onChangeBranch(b)}
              >
                {b}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!branch}>
              Weiter
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <h2 className="text-xl font-medium">Was machst du?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activities.map((a) => (
              <Button
                key={a}
                type="button"
                variant={activity === a ? "default" : "outline"}
                className="h-auto py-4 px-4 justify-center"
                aria-pressed={activity === a}
                onClick={() => onChangeActivity(a)}
              >
                {a}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => {}} disabled={!activity}>
              Fertig
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border p-3 text-sm bg-secondary/60">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" /> <span>{branch || "Keine Filiale"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> <span>{activity || "Keine Tätigkeit"}</span>
        </div>
      </div>
    </div>
  );
}
