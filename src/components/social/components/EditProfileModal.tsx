import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: {
    display_name?: string;
    username?: string;
    bio?: string;
    avatar_file?: File;
    interests?: string[];
  }) => void;
  user: SocialUserWithDetails | null;
  isUploading: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user,
  isUploading,
}) => {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [interests, setInterests] = useState(user?.interests?.join(', ') || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');

  useEffect(() => {
    setDisplayName(user?.display_name || '');
    setUsername(user?.username || '');
    setBio(user?.bio || '');
    setInterests(user?.interests?.join(', ') || '');
    setAvatarPreview(user?.avatar_url || '');
    setAvatarFile(null);
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Avatar file size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (!displayName.trim() || !username.trim()) {
      toast.error('Display name and username are required');
      return;
    }

    onConfirm({
      display_name: displayName,
      username,
      bio,
      avatar_file: avatarFile,
      interests: interests.split(',').map(i => i.trim()).filter(i => i),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 sm:p-4 overflow-y-auto">
      <Card className="bg-white rounded-lg shadow-xl w-full max-w-lg sm:max-w-lg dark:bg-gray-800 mx-2 sm:mx-0 flex flex-col" style={{ maxHeight: '95vh' }}>
        <CardHeader className="flex items-center justify-between sticky top-0 z-10 bg-white dark:bg-gray-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">Edit Profile</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-600 dark:text-gray-300">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
                Avatar
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-gray-700">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex items-center justify-center h-full text-slate-600 dark:text-gray-300">
                      {user?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="text-sm text-slate-600 dark:text-gray-300 bg-white dark:bg-gray-700 border-slate-200 dark:border-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
                Display Name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
                Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
                Bio
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself"
                className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
                Interests (comma-separated)
              </label>
              <Input
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., technology, music, sports"
                className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="bg-blue-600 text-white shadow-md hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};