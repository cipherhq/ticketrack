import { useState, useEffect } from 'react';
import { sendTeamInvitationEmail } from '@/lib/emailService';import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, UserPlus, Mail, Shield, Loader2, Trash2, 
  CheckCircle, Clock, XCircle, MoreVertical, Edit2 
} from 'lucide-react';


const ROLES = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-700', permissions: 'Full access to everything' },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700', permissions: 'Edit events, manage tasks & team' },
  coordinator: { label: 'Coordinator', color: 'bg-green-100 text-green-700', permissions: 'Check-in, view & complete tasks' },
  staff: { label: 'Staff', color: 'bg-gray-100 text-gray-700', permissions: 'Check-in attendees only' },
};

const STATUS_ICONS = {
  active: <CheckCircle className="w-4 h-4 text-green-500" />,
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  inactive: <XCircle className="w-4 h-4 text-gray-400" />,
};

export function TeamManagement() {
  const { organizer } = useOrganizer();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', firstName: '', lastName: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);

  useEffect(() => {
    if (organizer?.id) loadTeamMembers();
  }, [organizer?.id]);

  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizer_team_members')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading team:', error);
      alert('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteData.email) {
      alert('Email is required');
      return;
    }

    setSaving(true);
    try {
      // Check if already invited
      const existing = members.find(m => m.email.toLowerCase() === inviteData.email.toLowerCase());
      if (existing) {
        alert('This email is already on your team');
        return;
      }

      const { data, error } = await supabase
        .from('organizer_team_members')
        .insert({
          organizer_id: organizer.id,
          email: inviteData.email.toLowerCase(),
          name: inviteData.firstName && inviteData.lastName ? `${inviteData.firstName} ${inviteData.lastName}` : inviteData.firstName || inviteData.email.split('@')[0],
          role: inviteData.role,
          status: 'pending',
          invited_by: organizer.user_id,
        })
        .select()
        .single();

      if (error) throw error;

      setMembers([...members, data]);
      const emailToSend = inviteData.email;
      const firstNameToSend = inviteData.firstName || inviteData.email.split("@")[0];
      const roleToSend = inviteData.role;
      setShowInvite(false);
      setInviteData({ email: '', firstName: '', lastName: '', role: 'staff' });
      const link = `${window.location.origin}/accept-invite?token=${data.invitation_token}`;
      setInviteLink(link);
      
      // Send invitation email
      const roleLabels = { owner: "Owner", manager: "Manager", coordinator: "Coordinator", staff: "Staff" };
      await sendTeamInvitationEmail(emailToSend, {
        firstName: firstNameToSend,
        organizerName: organizer.name || organizer.business_name,
        roleName: roleLabels[roleToSend] || "Team Member",
        inviteLink: link
      }, organizer.id);
      
      alert("Invitation sent to " + emailToSend + "!");

    } catch (error) {
      console.error('Error inviting member:', error);
      alert('Failed to invite team member');
    } finally {
      setSaving(false);
    }
  };

  const updateMemberRole = async (memberId, newRole) => {
    try {
      const { error } = await supabase
        .from('organizer_team_members')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setEditingMember(null);
      alert('Role updated');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const { error } = await supabase
        .from('organizer_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
      alert('Team member removed');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove team member');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">Team Management</h1>
          <p className="text-[#0F0F0F]/60">Invite and manage your event team</p>
        </div>
        <Button
          onClick={() => setShowInvite(true)}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Role Legend */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Team Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(ROLES).map(([key, role]) => (
              <div key={key} className="p-3 rounded-xl bg-[#F4F6FA]">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-[#0F0F0F]/60" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                    {role.label}
                  </span>
                </div>
                <p className="text-xs text-[#0F0F0F]/60">{role.permissions}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-3" />
              <p className="text-[#0F0F0F]/60 mb-4">No team members yet</p>
              <Button
                onClick={() => setShowInvite(true)}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-xl bg-[#F4F6FA] flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                      {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-[#0F0F0F]">{member.name || member.email}</h4>
                        {STATUS_ICONS[member.status]}
                      </div>
                      <p className="text-sm text-[#0F0F0F]/60">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingMember === member.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#0F0F0F]/10 text-sm"
                      >
                        {Object.entries(ROLES).map(([key, role]) => (
                          <option key={key} value={key}>{role.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROLES[member.role]?.color}`}>
                        {ROLES[member.role]?.label}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingMember(editingMember === member.id ? null : member.id)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#2969FF]" />
                Invite Team Member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F0F0F] mb-1">Email *</label>
                <Input
                  type="email"
                  placeholder="team@example.com"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#0F0F0F] mb-1">First Name</label>
                  <Input
                    placeholder="John"
                    value={inviteData.firstName}
                    onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F0F0F] mb-1">Last Name</label>
                  <Input
                    placeholder="Doe"
                    value={inviteData.lastName}
                    onChange={(e) => setInviteData({ ...inviteData, lastName: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F0F0F] mb-1">Role</label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-[#0F0F0F]/10"
                >
                  {Object.entries(ROLES).filter(([key]) => key !== 'owner').map(([key, role]) => (
                    <option key={key} value={key}>{role.label} - {role.permissions}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowInvite(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={inviteMember}
                  disabled={saving || !inviteData.email}
                  className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Invite
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
