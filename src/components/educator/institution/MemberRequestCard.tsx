// src/components/educator/institution/MemberRequestCard.tsx
// Card for reviewing and approving/rejecting pending membership requests.

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { InstitutionMemberRole } from '@/types/Education';

interface PendingMember {
  id: string;
  user_id: string;
  institution_id: string;
  role: string;
  status: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
}

interface MemberRequestCardProps {
  member: PendingMember;
  onProcessed?: () => void;
}

export const MemberRequestCard: React.FC<MemberRequestCardProps> = ({
  member,
  onProcessed,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [assignRole, setAssignRole] = useState<InstitutionMemberRole>('student');

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('institution_members')
        .update({
          status: 'active',
          role: assignRole,
          joined_at: new Date().toISOString(),
        })
        .eq('id', member.id);

      if (error) throw error;
      toast.success(`${member.profile?.full_name || 'Member'} approved as ${assignRole}`);
      onProcessed?.();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('institution_members')
        .update({ status: 'removed' })
        .eq('id', member.id);

      if (error) throw error;
      toast.success(`Request from ${member.profile?.full_name || 'Unknown'} rejected`);
      onProcessed?.();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject');
    } finally {
      setIsProcessing(false);
    }
  };

  const timeSinceRequest = () => {
    const diff = Date.now() - new Date(member.created_at).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="rounded-xl border-dashed border-yellow-300 dark:border-yellow-700">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={member.profile?.avatar_url || undefined} />
            <AvatarFallback>
              {(member.profile?.full_name || '??').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {member.profile?.full_name || 'Unknown User'}
              </p>
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                <Clock className="w-3 h-3 mr-0.5" />
                Pending
              </Badge>
            </div>
            <p className="text-xs text-gray-500 truncate">
              {member.profile?.email || member.user_id}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Requested {timeSinceRequest()}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-2">
          <Select value={assignRole} onValueChange={(v) => setAssignRole(v as InstitutionMemberRole)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="educator">Educator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={handleReject}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5 mr-1" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
              )}
              Approve
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberRequestCard;
