// src/components/educator/institution/InstitutionSettings.tsx
// Institution settings form — name, description, contact info, education level.

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Loader2, Save } from 'lucide-react';
import { useInstitution } from '@/hooks/useInstitution';
import type { Institution } from '@/types/Education';

interface InstitutionSettingsProps {
  institution: Institution;
}

export const InstitutionSettings: React.FC<InstitutionSettingsProps> = ({
  institution,
}) => {
  const { updateInstitution } = useInstitution();
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: institution.name,
    description: institution.description || '',
    website: institution.website || '',
    address: institution.address || '',
    city: institution.city || '',
    region: institution.region || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    await updateInstitution({
      name: form.name,
      description: form.description || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      region: form.region || null,
    } as any);
    setIsSaving(false);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Institution Name</label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Institution name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Brief description of your institution"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Website</label>
            <Input
              value={form.website}
              onChange={(e) => updateField('website', e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">City</label>
              <Input
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Region</label>
              <Input
                value={form.region}
                onChange={(e) => updateField('region', e.target.value)}
                placeholder="Region / State"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim()}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="rounded-2xl border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Deactivating the institution will hide it from search and prevent new members from joining.
          </p>
          <Button variant="destructive" size="sm" disabled>
            Deactivate Institution
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstitutionSettings;
