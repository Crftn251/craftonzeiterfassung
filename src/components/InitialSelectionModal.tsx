import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface Branch {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

interface InitialSelectionModalProps {
  isOpen: boolean;
  onComplete: (branchId: string, activityId: string) => void;
}

export default function InitialSelectionModal({ isOpen, onComplete }: InitialSelectionModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [branchActivities, setBranchActivities] = useState<Record<string, string[]>>({});
  const [userActivities, setUserActivities] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      // Load branches
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      setBranches(branchData || []);

      // Load all activities
      const { data: activityData } = await supabase
        .from('activities')
        .select('id, name')
        .order('name');

      setActivities(activityData || []);

      // Load user's allowed activities
      const { data: userActivityData } = await supabase
        .from('profile_activities')
        .select('activity_id')
        .eq('profile_id', user.user.id);

      const userActivityIds = userActivityData?.map(pa => pa.activity_id) || [];
      setUserActivities(userActivityIds);

      // Load branch-activity assignments
      const { data: branchActivityData } = await supabase
        .from('branch_activities')
        .select(`
          branch_id,
          activity_id,
          branches!inner(name),
          activities!inner(name)
        `);

      const activityMap: Record<string, string[]> = {};
      branchActivityData?.forEach((ba: any) => {
        const branchName = ba.branches.name;
        const activityName = ba.activities.name;
        
        if (!activityMap[branchName]) {
          activityMap[branchName] = [];
        }
        activityMap[branchName].push(activityName);
      });

      setBranchActivities(activityMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Filter activities to show ONLY user-assigned activities
  const getFilteredActivities = (branchName?: string) => {
    let availableActivities = activities.filter(a => userActivities.includes(a.id));
    
    if (branchName && branchActivities[branchName]) {
      const branchActivityNames = branchActivities[branchName];
      availableActivities = availableActivities.filter(a => branchActivityNames.includes(a.name));
    }

    return availableActivities;
  };

  const currentAvailableActivities = getFilteredActivities(
    selectedBranch ? branches.find(b => b.id === selectedBranch)?.name : undefined
  );

  // Reset activity selection if current activity is no longer available
  useEffect(() => {
    if (selectedActivity && !currentAvailableActivities.some(a => a.id === selectedActivity)) {
      setSelectedActivity('');
    }
  }, [selectedActivity, currentAvailableActivities]);

  const handleStart = () => {
    if (!selectedBranch || !selectedActivity) {
      toast({
        title: "Unvollständige Auswahl",
        description: "Bitte wählen Sie eine Filiale und Tätigkeit aus.",
        variant: "destructive"
      });
      return;
    }

    onComplete(selectedBranch, selectedActivity);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Zeiterfassung starten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-select" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Filiale
            </Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger id="branch-select">
                <SelectValue placeholder="Filiale wählen" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity-select" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Tätigkeit
            </Label>
            <Select value={selectedActivity} onValueChange={setSelectedActivity}>
              <SelectTrigger id="activity-select">
                <SelectValue placeholder="Tätigkeit wählen" />
              </SelectTrigger>
              <SelectContent>
                {currentAvailableActivities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleStart} className="w-full" size="lg">
            Zeiterfassung starten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}