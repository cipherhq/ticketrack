import { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Plus,
  MoreVertical,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

const availablePermissions = [
  { id: 'dashboard', label: 'View Dashboard', group: 'General' },
  { id: 'events', label: 'Manage Events', group: 'Events' },
  { id: 'organizers', label: 'Manage Organizers', group: 'Users' },
  { id: 'attendees', label: 'View Attendees', group: 'Users' },
  { id: 'kyc', label: 'Review KYC', group: 'Verification' },
  { id: 'payouts', label: 'Process Payouts', group: 'Finance' },
  { id: 'refunds', label: 'Process Refunds', group: 'Finance' },
  { id: 'support', label: 'Handle Support', group: 'Support' },
  { id: 'emails', label: 'Send Emails', group: 'Communication' },
  { id: 'sms', label: 'Send SMS', group: 'Communication' },
  { id: 'settings', label: 'Platform Settings', group: 'System' },
  { id: 'roles', label: 'Manage Roles', group: 'System' },
];

const defaultRoles = [
  { name: 'super_admin', label: 'Super Admin', permissions: availablePermissions.map(p => p.id), isSystem: true },
  { name: 'admin', label: 'Admin', permissions: ['dashboard', 'events', 'organizers', 'attendees', 'kyc', 'support'], isSystem: true },
  { name: 'support', label: 'Support Agent', permissions: ['dashboard', 'attendees', 'support', 'refunds'], isSystem: true },
  { name: 'finance', label: 'Finance Manager', permissions: ['dashboard', 'payouts', 'refunds'], isSystem: true },
];

export function AdminRoles() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [editAdminDialogOpen, setEditAdminDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [newAdmin, setNewAdmin] = useState({
    email: '',
    role: 'admin',
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_admin, admin_role, created_at')
        .eq('is_admin', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdmin.email) {
      alert('Please enter an email address');
      return;
    }

    setProcessing(true);
    try {
      // Find user by email
      const { data: user, error: findError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', newAdmin.email)
        .single();

      if (findError || !user) {
        alert('User not found. They must have an account first.');
        setProcessing(false);
        return;
      }

      // Update user to be admin
      const { error } = await supabase
        .from('profiles')
        .update({
          is_admin: true,
          admin_role: newAdmin.role,
        })
        .eq('id', user.id);

      if (error) throw error;

      await logAdminAction('admin_added', 'profile', user.id, { role: newAdmin.role });
      alert('Admin added successfully!');
      setAddAdminDialogOpen(false);
      setNewAdmin({ email: '', role: 'admin' });
      loadAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      alert('Failed to add admin');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedAdmin) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ admin_role: selectedAdmin.admin_role })
        .eq('id', selectedAdmin.id);

      if (error) throw error;

      await logAdminAction('admin_role_updated', 'profile', selectedAdmin.id, { role: selectedAdmin.admin_role });
      alert('Role updated successfully!');
      setEditAdminDialogOpen(false);
      loadAdmins();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveAdmin = async (adminUser) => {
    if (adminUser.id === admin.id) {
      alert('You cannot remove yourself as admin');
      return;
    }

    if (!confirm(`Remove admin privileges from ${adminUser.email}?`)) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_admin: false,
          admin_role: null,
        })
        .eq('id', adminUser.id);

      if (error) throw error;

      await logAdminAction('admin_removed', 'profile', adminUser.id);
      alert('Admin removed successfully');
      loadAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      alert('Failed to remove admin');
    } finally {
      setProcessing(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-purple-100 text-purple-700">Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-700">Admin</Badge>;
      case 'support':
        return <Badge className="bg-green-100 text-green-700">Support</Badge>;
      case 'finance':
        return <Badge className="bg-orange-100 text-orange-700">Finance</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getRolePermissions = (roleName) => {
    const role = defaultRoles.find(r => r.name === roleName);
    return role?.permissions || [];
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Roles & Permissions</h2>
          <p className="text-muted-foreground mt-1">Manage admin users and their access levels</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadAdmins} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setAddAdminDialogOpen(true)}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Admin
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Users */}
        <div className="lg:col-span-2">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">Admin Users ({admins.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {admins.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No admin users</p>
              ) : (
                <div className="space-y-3">
                  {admins.map((adminUser) => (
                    <div
                      key={adminUser.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                          {adminUser.full_name?.charAt(0) || adminUser.email?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">
                            {adminUser.full_name || 'Unnamed'}
                            {adminUser.id === admin.id && (
                              <span className="text-xs text-muted-foreground ml-2">(You)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{adminUser.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRoleBadge(adminUser.admin_role)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl">
                              <MoreVertical className="w-5 h-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAdmin(adminUser);
                                setEditAdminDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Role
                            </DropdownMenuItem>
                            {adminUser.id !== admin.id && (
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleRemoveAdmin(adminUser)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Roles Info */}
        <div className="space-y-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">Available Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {defaultRoles.map((role) => (
                <div key={role.name} className="p-3 bg-muted rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{role.label}</span>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-xs">System</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {role.permissions.length} permissions
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/10 rounded-2xl bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-foreground font-medium mb-1">Role Permissions</p>
                  <p className="text-sm text-foreground/80">
                    Super Admin has full access. Other roles have limited permissions based on their responsibilities.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="pl-10 rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                User must already have a Ticketrack account
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newAdmin.role}
                onValueChange={(value) => setNewAdmin({ ...newAdmin, role: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {defaultRoles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show permissions for selected role */}
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm font-medium text-foreground mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {getRolePermissions(newAdmin.role).map((perm) => (
                  <Badge key={perm} variant="outline" className="text-xs">
                    {availablePermissions.find(p => p.id === perm)?.label || perm}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddAdminDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdmin}
              disabled={processing || !newAdmin.email}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={editAdminDialogOpen} onOpenChange={setEditAdminDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Admin Role</DialogTitle>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
                <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                  {selectedAdmin.full_name?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-foreground font-medium">{selectedAdmin.full_name || 'Unnamed'}</p>
                  <p className="text-sm text-muted-foreground">{selectedAdmin.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedAdmin.admin_role}
                  onValueChange={(value) =>
                    setSelectedAdmin({ ...selectedAdmin, admin_role: value })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {defaultRoles.map((role) => (
                      <SelectItem key={role.name} value={role.name}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm font-medium text-foreground mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {getRolePermissions(selectedAdmin.admin_role).map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {availablePermissions.find(p => p.id === perm)?.label || perm}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditAdminDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={processing}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
