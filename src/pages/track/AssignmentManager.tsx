import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings } from "lucide-react";
interface AssignmentManagerProps {
  currentBranch: string;
  branchActivities: Record<string, string[]>;
  allActivities: string[];
  onRefresh: () => void;
}
export default function AssignmentManager({
  currentBranch,
  branchActivities,
  allActivities,
  onRefresh
}: AssignmentManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [branchId, setBranchId] = useState<string>("");
  const [activityIds, setActivityIds] = useState<Record<string, string>>({});
  useEffect(() => {
    if (isOpen && currentBranch) {
      loadData();
    }
  }, [isOpen, currentBranch]);
  const loadData = async () => {
    // Get branch ID
    const {
      data: branchData
    } = await supabase.from('branches').select('id').eq('name', currentBranch).single();
    if (!branchData) return;
    setBranchId(branchData.id);

    // Get activity IDs
    const {
      data: activityData
    } = await supabase.from('activities').select('id, name');
    if (activityData) {
      const idMap = Object.fromEntries(activityData.map(a => [a.name, a.id]));
      setActivityIds(idMap);
    }

    // Set currently selected activities
    const currentActivities = branchActivities[currentBranch] || [];
    setSelectedActivities(currentActivities);
  };
  const handleSave = async () => {
    if (!branchId) return;
    setLoading(true);

    // First, delete all existing assignments for this branch
    await supabase.from('branch_activities').delete().eq('branch_id', branchId);

    // Then insert new assignments
    const assignments = selectedActivities.map(activityName => ({
      branch_id: branchId,
      activity_id: activityIds[activityName]
    })).filter(a => a.activity_id);
    if (assignments.length > 0) {
      const {
        error
      } = await supabase.from('branch_activities').insert(assignments);
      if (error) {
        toast({
          title: 'Fehler',
          description: error.message,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }
    }
    toast({
      title: 'Erfolg',
      description: 'Zuordnungen aktualisiert'
    });
    setLoading(false);
    setIsOpen(false);
    onRefresh();
  };
  const handleActivityToggle = (activityName: string, checked: boolean) => {
    if (checked) {
      setSelectedActivities(prev => [...prev, activityName]);
    } else {
      setSelectedActivities(prev => prev.filter(a => a !== activityName));
    }
  };
  if (!currentBranch) {
    return null;
  }
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tätigkeiten für "{currentBranch}"</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wählen Sie die Tätigkeiten aus, die in dieser Branch verfügbar sein sollen:
          </p>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {allActivities.map(activity => <div key={activity} className="flex items-center space-x-2">
                <Checkbox id={activity} checked={selectedActivities.includes(activity)} onCheckedChange={checked => handleActivityToggle(activity, !!checked)} />
                <label htmlFor={activity} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  {activity}
                </label>
              </div>)}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              Speichern
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}