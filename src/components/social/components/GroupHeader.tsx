// src/components/social/components/GroupHeader.tsx
import React from 'react';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import { ArrowLeft, Settings, Users, Lock, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GroupHeaderProps {
  group: any;
  isMember: boolean;
  canManage: boolean;
  onOpenSettings: () => void;
}

export const GroupHeader: React.FC<GroupHeaderProps> = ({
  group,
  isMember,
  canManage,
  onOpenSettings,
}) => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Cover Photo */}
      <div className="h-48 lg:h-64 bg-gradient-to-r from-blue-600 to-blue-700 relative overflow-hidden flex items-center justify-center">
        {group.cover_image_url ? (
                <img
            src={group.cover_image_url}
            alt="Group cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600" />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Back Button */}
      <div className="absolute top-4 left-4 ">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Settings Button (Admin/Mod only) */}
      {canManage && (
        <div className="absolute top-4 right-4 ">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Group Info */}
      <div className="px-4 lg:px-6 pb-6 -mt-16 lg:-mt-20 relative ">
        <div className="flex items-end gap-4 lg:gap-6">
          <Avatar className="h-24 w-24 lg:h-32 lg:w-32 border-4 lg:border-8 border-white dark:border-slate-900 shadow-2xl">
            <AvatarImage src={group.avatar_url} />
            <AvatarFallback className="text-3xl lg:text-5xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {group.name[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                {group.name}
              </h1>
              {group.privacy === 'private' ? (
                <Badge variant="secondary" className="bg-white/90 dark:bg-gray-800">
                  <Lock className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-white/90 dark:bg-gray-800">
                  <Globe className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              )}
            </div>

            <p className="text-white/90 text-sm lg:text-base mt-2 max-w-2xl drop-shadow" >
              {group.description || 'No description'}
            </p>

            <div className="flex items-center gap-4 mt-3 dark:text-white/80 text-sm lg:text-base">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{group.members_count || 0} members</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};