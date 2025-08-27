import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit, Plus, Save, X } from "lucide-react";

interface BranchManagerProps {
  branches: string[];
  onRefresh: () => void;
}

export default function BranchManager({ branches, onRefresh }: BranchManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [loading, setLoading] = useState(false);
  const [branchData, setBranchData] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  const loadBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .order('name');
    
    if (error) {
      toast({ title: 'Fehler', description: 'Konnte Branches nicht laden', variant: 'destructive' });
      return;
    }
    
    setBranchData(data || []);
  };

  const handleCreate = async () => {
    if (!newBranchName.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('branches')
      .insert({ name: newBranchName.trim() });
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Branch erstellt' });
      setNewBranchName("");
      await loadBranches();
      onRefresh();
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('branches')
      .update({ name: newName.trim() })
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: 'Branch aktualisiert' });
      setEditingId(null);
      await loadBranches();
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
      .eq('branch_id', id);
    
    // Then delete the branch
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Erfolg', description: `Branch "${name}" gelöscht` });
      await loadBranches();
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
          <Edit className="h-4 w-4 mr-2" />
          Branches verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Branches verwalten</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Create new branch */}
          <div className="flex gap-2">
            <Input
              placeholder="Neue Branch..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button 
              onClick={handleCreate} 
              disabled={!newBranchName.trim() || loading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* List existing branches */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {branchData.map((branch) => (
              <div key={branch.id} className="flex items-center gap-2 p-2 border rounded">
                {editingId === branch.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(branch.id, editingName);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(branch.id, editingName)}
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
                    <span className="flex-1">{branch.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(branch.id, branch.name)}
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
                          <AlertDialogTitle>Branch löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Branch "{branch.name}" und alle zugehörigen Zuordnungen werden gelöscht. Dies kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(branch.id, branch.name)}
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