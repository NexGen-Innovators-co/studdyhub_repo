// src/components/educator/onboarding/IndependentTutorSetup.tsx
// Quick setup for independent tutors — subjects, bio, availability.

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Check, Plus, X } from 'lucide-react';

interface IndependentTutorSetupProps {
  onComplete: (data: TutorSetupData) => void;
  onSkip: () => void;
}

export interface TutorSetupData {
  specializations: string[];
  bio: string;
  yearsExperience: string;
  availableHours: string;
}

export const IndependentTutorSetup: React.FC<IndependentTutorSetupProps> = ({
  onComplete,
  onSkip,
}) => {
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [newSpec, setNewSpec] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [availableHours, setAvailableHours] = useState('');

  const addSpecialization = () => {
    const trimmed = newSpec.trim();
    if (trimmed && !specializations.includes(trimmed)) {
      setSpecializations([...specializations, trimmed]);
      setNewSpec('');
    }
  };

  const removeSpecialization = (spec: string) => {
    setSpecializations(specializations.filter((s) => s !== spec));
  };

  const handleComplete = () => {
    onComplete({
      specializations,
      bio,
      yearsExperience,
      availableHours,
    });
  };

  const SUGGESTED_SUBJECTS = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'Computer Science',
    'Economics',
    'Accounting',
    'Literature',
    'History',
  ];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
          <GraduationCap className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Set Up Your Tutor Profile
        </h2>
        <p className="text-gray-500">Help students find you by sharing your expertise.</p>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-5">
          {/* Specializations */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Subjects / Specializations
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {specializations.map((spec) => (
                <Badge key={spec} variant="default" className="gap-1 px-3 py-1">
                  {spec}
                  <button onClick={() => removeSpecialization(spec)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                placeholder="Add a subject"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addSpecialization}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_SUBJECTS.filter((s) => !specializations.includes(s)).map((subject) => (
                <Badge
                  key={subject}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() =>
                    setSpecializations([...specializations, subject])
                  }
                >
                  + {subject}
                </Badge>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm font-medium mb-1 block">Short Bio</label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell students about your teaching style and experience..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">{bio.length}/500</p>
          </div>

          {/* Experience & availability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Years of Experience</label>
              <Input
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                placeholder="e.g. 5"
                type="number"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Available Hours / Week</label>
              <Input
                value={availableHours}
                onChange={(e) => setAvailableHours(e.target.value)}
                placeholder="e.g. 20"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
            <Button onClick={handleComplete}>
              <Check className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndependentTutorSetup;
