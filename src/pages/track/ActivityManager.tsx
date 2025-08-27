import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus, Save, X, Briefcase } from "lucide-react";

interface ActivityManagerProps {
  activities: string[];
  onRefresh: () => void;
}

export default function ActivityManager({ activities, onRefresh }: ActivityManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newActivityName, setNewActivityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [activityData, setActivityData] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadActivities();
    }
  }, [isOpen]);

  const loadActivities = async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('id, name')
      .order('name');
    
    if (error) {
      toast({ title: 'Fehler', description: 'Konnte Tätigkeiten nicht laden', variant: 'destructive' });
      return;
    }
    
    setActivityData(data || []);
  };

  const handleCreate = async () => {
    if (!newActivityName.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('activities')
      .insert({ name: newActivityName.trim() });
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Tätigkeit erstellt' });
      setNewActivityName("");
      await loadActivities();
      onRefresh();
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('activities')
      .update({ name: newName.trim() })
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Tätigkeit aktualisiert' });
      setEditingId(null);
      await loadActivities();
      onRefresh();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    setLoading(true);
    
    // First delete related branch_activities
    await supabase
      .from('branch_activities')
      .delete()
      .eq('activity_id', id);
    
    // Then delete the activity
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `Tätigkeit "${name}" gelöscht` });
      await loadActivities();
      onRefresh();
    }
    setLoading(false);
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Briefcase className="h-4 w-4 mr-2" />
          Tätigkeiten verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tätigkeiten verwalten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Create new activity */}
          <div className="flex gap-2">
            <Input
              placeholder="Neue Tätigkeit..."
              value={newActivityName}
              onChange={(e) => setNewActivityName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button 
              onClick={handleCreate} 
              disabled={!newActivityName.trim() || loading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* List existing activities */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {activityData.map((activity) => (
              <div key={activity.id} className="flex items-center gap-2 p-2 border rounded">
                {editingId === activity.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(activity.id, editingName);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(activity.id, editingName)}
                      disabled={loading}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{activity.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(activity.id, activity.name)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tätigkeit löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tätigkeit "{activity.name}" und alle zugehörigen Zuordnungen werden gelöscht. Dies kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(activity.id, activity.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}