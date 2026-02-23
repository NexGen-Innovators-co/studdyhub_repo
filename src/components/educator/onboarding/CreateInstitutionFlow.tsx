// src/components/educator/onboarding/CreateInstitutionFlow.tsx
// Multi-step flow for school admins to create their institution during onboarding.

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, Check, Globe, MapPin } from 'lucide-react';
import { useInstitution, type CreateInstitutionInput } from '@/hooks/useInstitution';
import type { InstitutionType } from '@/types/Education';

interface CreateInstitutionFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
  { value: 'school', label: 'School (K-12)' },
  { value: 'university', label: 'University / College' },
  { value: 'tutoring_center', label: 'Tutoring Center' },
  { value: 'online_academy', label: 'Online Academy' },
];

export const CreateInstitutionFlow: React.FC<CreateInstitutionFlowProps> = ({
  onComplete,
  onSkip,
}) => {
  const { createInstitution } = useInstitution();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'details' | 'location' | 'done'>('details');

  const [form, setForm] = useState<CreateInstitutionInput>({
    name: '',
    slug: '',
    type: 'school',
    description: '',
    website: '',
    address: '',
    city: '',
    region: '',
  });

  const updateField = <K extends keyof CreateInstitutionInput>(key: K, value: CreateInstitutionInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    updateField('name', name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    updateField('slug', slug);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    setIsSubmitting(true);
    const result = await createInstitution(form);
    setIsSubmitting(false);

    if (result) {
      setStep('done');
    }
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Institution Created!
        </h3>
        <p className="text-gray-500 text-center max-w-sm">
          Your institution is ready. You can invite members and create courses from the educator dashboard.
        </p>
        <Button onClick={onComplete}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Create Your Institution
        </h2>
        <p className="text-gray-500">
          {step === 'details'
            ? 'Enter basic details about your school or academy.'
            : 'Where is your institution located?'}
        </p>
      </div>

      {step === 'details' && (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Institution Name *</label>
              <Input
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Accra Academy"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">URL Slug</label>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>studdyhub.vercel.app/i/</span>
                <Input
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  className="flex-1"
                  placeholder="accra-academy"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Type</label>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as InstitutionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description (optional)"
                rows={2}
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

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={onSkip}>
                Skip for now
              </Button>
              <Button onClick={() => setStep('location')} disabled={!form.name.trim()}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'location' && (
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Location (optional)</span>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Institution
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateInstitutionFlow;
