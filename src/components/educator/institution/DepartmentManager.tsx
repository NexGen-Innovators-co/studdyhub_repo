// src/components/educator/institution/DepartmentManager.tsx
// Manages departments within an institution.
// Departments are stored as a JSON array in institution settings.

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Institution } from '@/types/Education';

interface Department {
  id: string;
  name: string;
  head?: string;
  description?: string;
}

interface DepartmentManagerProps {
  institution: Institution;
  isAdmin: boolean;
  onUpdate?: () => void;
}

export const DepartmentManager: React.FC<DepartmentManagerProps> = ({
  institution,
  isAdmin,
  onUpdate,
}) => {
  const departments = useMemo<Department[]>(() => {
    const raw = (institution.settings as any)?.departments;
    return Array.isArray(raw) ? raw : [];
  }, [institution.settings]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [head, setHead] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setName('');
    setHead('');
    setDescription('');
    setEditingDept(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setHead(dept.head || '');
    setDescription(dept.description || '');
    setShowDialog(true);
  };

  const saveDepartments = async (newDepts: Department[]) => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...(institution.settings as Record<string, unknown>),
        departments: newDepts,
      };

      const { error } = await supabase
        .from('institutions')
        .update({ settings: updatedSettings })
        .eq('id', institution.id);

      if (error) throw error;
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update departments');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }

    let newDepts: Department[];
    if (editingDept) {
      newDepts = departments.map((d) =>
        d.id === editingDept.id
          ? { ...d, name: name.trim(), head: head.trim() || undefined, description: description.trim() || undefined }
          : d
      );
      toast.success('Department updated');
    } else {
      const newDept: Department = {
        id: crypto.randomUUID(),
        name: name.trim(),
        head: head.trim() || undefined,
        description: description.trim() || undefined,
      };
      newDepts = [...departments, newDept];
      toast.success('Department added');
    }

    await saveDepartments(newDepts);
    resetForm();
    setShowDialog(false);
  };

  const handleDelete = async () => {
    if (!deptToDelete) return;
    const newDepts = departments.filter((d) => d.id !== deptToDelete.id);
    await saveDepartments(newDepts);
    toast.success('Department removed');
    setDeptToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-500" />
            Departments
          </h3>
          <p className="text-sm text-gray-500">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        )}
      </div>

      {/* Department list */}
      {departments.length === 0 ? (
        <div className="text-center py-8">
          <FolderTree className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No departments defined yet.</p>
          {isAdmin && (
            <Button onClick={openCreate} variant="outline" size="sm" className="mt-3">
              <Plus className="w-4 h-4 mr-2" />
              Create First Department
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {departments.map((dept) => (
            <Card key={dept.id} className="rounded-xl">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                  <FolderTree className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {dept.name}
                  </p>
                  {dept.head && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Head: {dept.head}
                    </p>
                  )}
                  {dept.description && (
                    <p className="text-xs text-gray-400 truncate">{dept.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(dept)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={() => setDeptToDelete(dept)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { resetForm(); setShowDialog(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'Add Department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Department Head</label>
              <Input
                value={head}
                onChange={(e) => setHead(e.target.value)}
                placeholder="Name of department head"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setShowDialog(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDept ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deptToDelete} onOpenChange={(open) => !open && setDeptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deptToDelete?.name}" from the institution? Members assigned to this department won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DepartmentManager;
