import React, { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Badge } from '../../ui/badge';
import {
  Save,
  Trash2,
  Upload,
  Globe,
  Lock,
  Shield,
  Users,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface GroupSettingsProps {
  groupId: string;
  group: any;
  currentUser: any;
  onGroupUpdate: () => void;
  onNavigateToGroups?: () => void;
}

export const GroupSettings: React.FC<GroupSettingsProps> = ({
  groupId,
  group,
  currentUser,
  onGroupUpdate,
  onNavigateToGroups
}) => {
  
  // Basic Info
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [category, setCategory] = useState(group.category || 'general');
  const [privacy, setPrivacy] = useState<'public' | 'private'>(group.privacy || 'public');
  
  // Advanced Settings
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [requireApproval, setRequireApproval] = useState(privacy === 'private');
  const [allowMemberInvites, setAllowMemberInvites] = useState(true);
  
  // Moderation
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [reportedContent, setReportedContent] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch pending members and reported content
  React.useEffect(() => {
    fetchPendingMembers();
    fetchReportedContent();
  }, [groupId]);

  const fetchPendingMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('social_group_members')
        .select(`
          id,
          user_id,
          joined_at,
          user:social_users(*)
        `)
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('joined_at', { ascending: false });

      if (!error && data) {
        setPendingMembers(data);
      }
    } catch (error) {
      console.error('Error fetching pending members:', error);
    }
  };
const navigate = useNavigate();
  const fetchReportedContent = async () => {
    try {
      const { data, error } = await supabase
        .from('social_reports')
        .select(`
          *,
          reporter:social_users!social_reports_reporter_id_fkey(*),
          reported_user:social_users!social_reports_reported_user_id_fkey(*),
          post:social_posts(*)
        `)
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReportedContent(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${groupId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('social-media')
        .upload(fileName, selectedFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('social-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  const handleSaveSettings = async () => {
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = group.avatar_url;
      
      if (selectedFile) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from('social_groups')
        .update({
          name: name.trim(),
          description: description.trim(),
          category,
          privacy,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group settings updated successfully!');
      onGroupUpdate();
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    const confirmMessage = `Are you sure you want to delete "${group.name}"? This action cannot be undone and will remove all posts, members, and data associated with this group.`;
    
    if (!window.confirm(confirmMessage)) return;

    const doubleConfirm = window.prompt(
      `Type "${group.name}" to confirm deletion:`
    );

    if (doubleConfirm !== group.name) {
      toast.error('Group name did not match. Deletion cancelled.');
      return;
    }

    setIsDeleting(true);
    try {
      // Delete all related data
      await Promise.all([
        supabase.from('social_group_members').delete().eq('group_id', groupId),
        supabase.from('social_posts').delete().eq('group_id', groupId),
        supabase.from('social_events').delete().eq('group_id', groupId),
        supabase.from('social_chat_messages').delete().eq('group_id', groupId),
      ]);

      // Delete the group
      const { error } = await supabase
        .from('social_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group deleted successfully');
      navigate('/social/groups');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApproveMember = async (membershipId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('social_group_members')
        .update({ status: 'active' })
        .eq('id', membershipId);

      if (error) throw error;

      // Send notification
      await supabase.from('social_notifications').insert({
        user_id: userId,
        type: 'group_invite',
        title: 'Request Approved',
        message: `Your request to join "${group.name}" has been approved!`,
        data: { group_id: groupId }
      });

      setPendingMembers(prev => prev.filter(m => m.id !== membershipId));
      toast.success('Member approved');
    } catch (error) {
      console.error('Error approving member:', error);
      toast.error('Failed to approve member');
    }
  };

  const handleRejectMember = async (membershipId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('social_group_members')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      // Send notification
      await supabase.from('social_notifications').insert({
        user_id: userId,
        type: 'group_invite',
        title: 'Request Declined',
        message: `Your request to join "${group.name}" was declined.`,
        data: { group_id: groupId }
      });

      setPendingMembers(prev => prev.filter(m => m.id !== membershipId));
      toast.success('Request declined');
    } catch (error) {
      console.error('Error rejecting member:', error);
      toast.error('Failed to reject member');
    }
  };

  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'resolve') => {
    try {
      const { error } = await supabase
        .from('social_reports')
        .update({
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          moderator_id: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      setReportedContent(prev => prev.filter(r => r.id !== reportId));
      toast.success(`Report ${action === 'dismiss' ? 'dismissed' : 'resolved'}`);
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error('Failed to update report');
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)] pb-6 pt-6 overflow-y-auto">
      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Basic Settings
          </CardTitle>
          <CardDescription>
            Update your group's basic information and appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Group Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={previewUrl || group.avatar_url} />
              <AvatarFallback className="text-2xl">
                {name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="avatar-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Change Avatar
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Recommended: Square image, at least 200x200px
              </p>
            </div>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              maxLength={100}
            />
            <p className="text-xs text-gray-500">{name.length}/100</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your group's purpose"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-gray-500">{description.length}/500</p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="study">📚 Study Group</SelectItem>
                <SelectItem value="project">💻 Project Collaboration</SelectItem>
                <SelectItem value="discussion">💬 Discussion Forum</SelectItem>
                <SelectItem value="exam-prep">📝 Exam Preparation</SelectItem>
                <SelectItem value="research">🔬 Research Group</SelectItem>
                <SelectItem value="other">🎯 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Privacy */}
          <div className="space-y-2">
            <Label htmlFor="privacy">Privacy</Label>
            <Select value={privacy} onValueChange={(v: 'public' | 'private') => setPrivacy(v)}>
              <SelectTrigger id="privacy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center">
                    <Globe className="h-4 w-4 mr-2" />
                    <div>
                      <p className="font-medium">Public</p>
                      <p className="text-xs text-gray-500">Anyone can join</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center">
                    <Lock className="h-4 w-4 mr-2" />
                    <div>
                      <p className="font-medium">Private</p>
                      <p className="text-xs text-gray-500">Approval required</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Pending Member Requests */}
      {privacy === 'private' && pendingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pending Requests ({pendingMembers.length})
            </CardTitle>
            <CardDescription>
              Review and approve member join requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.user.avatar_url} />
                    <AvatarFallback>
                      {member.user.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.user.display_name}</p>
                    <p className="text-sm text-gray-500">@{member.user.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApproveMember(member.id, member.user_id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectMember(member.id, member.user_id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reported Content */}
      {reportedContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reported Content ({reportedContent.length})
            </CardTitle>
            <CardDescription>
              Review and moderate reported posts and comments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportedContent.map((report) => (
              <div key={report.id} className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-300">
                      Reason: {report.reason}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reported by @{report.reporter.username}
                    </p>
                  </div>
                  <Badge variant="destructive">Pending</Badge>
                </div>
                {report.description && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {report.description}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleResolveReport(report.id, 'resolve')}
                  >
                    Take Action
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolveReport(report.id, 'dismiss')}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that will permanently affect this group
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDeleteGroup}
            disabled={isDeleting}
            className="w-full"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group Permanently
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};