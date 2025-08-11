import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
          <Select value={branch} onValueChange={onChangeBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Filiale wählen" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select value={activity} onValueChange={onChangeActivity}>
            <SelectTrigger>
              <SelectValue placeholder="Tätigkeit wählen" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
