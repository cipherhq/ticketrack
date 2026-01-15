import { useState, useEffect } from 'react';
import { 
  Shield, Users, Clock, AlertTriangle, CheckCircle, 
  Eye, EyeOff, UserPlus, Edit2, Trash2, Key, 
  Smartphone, MapPin, Activity, Ban, RefreshCw,
  Calendar, User, Lock, Unlock, Settings, 
  Phone, Mail, Globe, Monitor
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function AdminUserTypes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [failedAttempts, setFailedAttempts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModal, setUserModal] = useState({ open: false, user: null, mode: 'view' });
  const [roleModal, setRoleModal] = useState({ open: false, data: null, isNew: false });
  const [otpModal, setOtpModal] = useState({ open: false, userId: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadRoles(),
        loadSessions(),
        loadAuditLogs(),
        loadFailedAttempts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // First get all admin users from profiles
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', true)
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error loading users:', usersError);
        setUsers([]);
        return;
      }

      // Then get role assignments for these users
      if (usersData && usersData.length > 0) {
        const userIds = usersData.map(u => u.id);
        
        const { data: roleAssignments } = await supabase
          .from('user_role_assignments')
          .select(`*, role:user_roles(*)`)
          .in('user_id', userIds);

        // Merge role assignments with users
        const usersWithRoles = usersData.map(user => ({
          ...user,
          user_role_assignments: roleAssignments?.filter(ra => ra.user_id === user.id) || []
        }));

        setUsers(usersWithRoles);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadRoles = async () => {
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('*')
        .order('level', { ascending: false });

      setRoles(rolesData || []);
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    }
  };

  const loadSessions = async () => {
    try {
      const { data: sessionsData, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading sessions:', error);
        setSessions([]);
        return;
      }

      // Get user info for sessions
      if (sessionsData && sessionsData.length > 0) {
        const userIds = [...new Set(sessionsData.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const sessionsWithProfiles = sessionsData.map(session => ({
          ...session,
          profiles: profiles?.find(p => p.id === session.user_id) || null
        }));
        setSessions(sessionsWithProfiles);
      } else {
        setSessions([]);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const { data: logsData, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading audit logs:', error);
        setAuditLogs([]);
        return;
      }

      // Get user info for logs
      if (logsData && logsData.length > 0) {
        const userIds = [...new Set(logsData.filter(l => l.user_id).map(l => l.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

          const logsWithProfiles = logsData.map(log => ({
            ...log,
            profiles: profiles?.find(p => p.id === log.user_id) || null
          }));
          setAuditLogs(logsWithProfiles);
        } else {
          setAuditLogs(logsData);
        }
      } else {
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setAuditLogs([]);
    }
  };

  const loadFailedAttempts = async () => {
    try {
      const { data: attemptsData } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .order('last_attempt', { ascending: false })
        .limit(50);

      setFailedAttempts(attemptsData || []);
    } catch (error) {
      console.error('Error loading failed attempts:', error);
      setFailedAttempts([]);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    if (searchTerm && !user.email?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (filterRole !== 'all') {
      const hasRole = user.user_role_assignments?.some(assignment => 
        assignment.role?.name === filterRole && assignment.is_active
      );
      if (!hasRole) return false;
    }
    
    if (filterStatus !== 'all') {
      const isActive = user.user_sessions?.some(session => 
        session.is_active && new Date(session.expires_at) > new Date()
      );
      if (filterStatus === 'active' && !isActive) return false;
      if (filterStatus === 'inactive' && isActive) return false;
    }
    
    return true;
  });

  const assignRole = async (userId, roleId, expiresAt, reason) => {
    try {
      const { error } = await supabase
        .from('user_role_assignments')
        .upsert({
          user_id: userId,
          role_id: roleId,
          assigned_by: user?.id,
          expires_at: expiresAt,
          reason,
          is_active: true
        });

      if (error) throw error;

      // Log the security event
      await supabase.rpc('log_security_event', {
        p_user_id: user?.id,
        p_event_type: 'role_assigned',
        p_event_category: 'security',
        p_description: `Role assigned to user`,
        p_resource_type: 'user_role',
        p_resource_id: userId,
        p_metadata: { roleId, reason, expiresAt }
      });

      await loadUsers();
    } catch (error) {
      console.error('Error assigning role:', error);
      alert('Failed to assign role');
    }
  };

  const revokeRole = async (userId, roleId, reason) => {
    try {
      const { error } = await supabase
        .from('user_role_assignments')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id,
          revoked_reason: reason
        })
        .match({ user_id: userId, role_id: roleId });

      if (error) throw error;

      // Log the security event
      await supabase.rpc('log_security_event', {
        p_user_id: user?.id,
        p_event_type: 'role_revoked',
        p_event_category: 'security',
        p_description: `Role revoked from user`,
        p_resource_type: 'user_role',
        p_resource_id: userId,
        p_metadata: { roleId, reason }
      });

      await loadUsers();
    } catch (error) {
      console.error('Error revoking role:', error);
      alert('Failed to revoke role');
    }
  };

  const terminateSession = async (sessionId, reason) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          end_reason: reason || 'admin_terminated'
        })
        .eq('id', sessionId);

      if (error) throw error;
      await loadSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      alert('Failed to terminate session');
    }
  };

  const generateOTP = async (userId, phoneNumber) => {
    try {
      // This would integrate with your SMS service
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { error } = await supabase
        .from('user_otp')
        .insert({
          user_id: userId,
          phone_number: phoneNumber,
          otp_code: otp,
          otp_hash: btoa(otp), // In production, use proper hashing
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
          purpose: 'admin_access'
        });

      if (error) throw error;

      // Here you would send SMS via your SMS service
      alert(`OTP sent to ${phoneNumber}: ${otp} (Demo mode)`);
    } catch (error) {
      console.error('Error generating OTP:', error);
      alert('Failed to generate OTP');
    }
  };

  const getUserRole = (user) => {
    const activeRole = user.user_role_assignments?.find(
      assignment => assignment.is_active && 
      (!assignment.expires_at || new Date(assignment.expires_at) > new Date())
    );
    return activeRole?.role || null;
  };

  const getUserStatus = (user) => {
    const activeSessions = user.user_sessions?.filter(
      session => session.is_active && new Date(session.expires_at) > new Date()
    );
    
    if (activeSessions && activeSessions.length > 0) {
      return { status: 'active', color: 'green', text: 'Active' };
    }
    return { status: 'inactive', color: 'gray', text: 'Inactive' };
  };

  const getRiskLevel = (log) => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return colors[log.risk_level] || colors.low;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">User Access Management</h2>
          <p className="text-[#0F0F0F]/60">Zero-trust user role and security management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => setUserModal({ open: true, user: null, mode: 'create' })}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Users</p>
                <p className="text-2xl font-semibold">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Active Sessions</p>
                <p className="text-2xl font-semibold text-green-600">{sessions.length}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Security Events</p>
                <p className="text-2xl font-semibold text-orange-600">{auditLogs.length}</p>
              </div>
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Failed Attempts</p>
                <p className="text-2xl font-semibold text-red-600">{failedAttempts.length}</p>
              </div>
              <Ban className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Users className="absolute left-3 top-3 h-4 w-4 text-[#0F0F0F]/40" />
                <Input
                  placeholder="Search users by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            <div className="min-w-48">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active Sessions</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="audit">Security Audit</TabsTrigger>
          <TabsTrigger value="threats">Security Threats</TabsTrigger>
        </TabsList>

        {/* Users & Roles Tab */}
        <TabsContent value="users">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>User Access Control</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                    <p className="text-[#0F0F0F]/60">No users match your filters</p>
                  </div>
                ) : (
                  filteredUsers.map((userData) => {
                    const role = getUserRole(userData);
                    const status = getUserStatus(userData);
                    const hasExpiredRole = userData.user_role_assignments?.some(
                      assignment => assignment.expires_at && new Date(assignment.expires_at) <= new Date()
                    );

                    return (
                      <div key={userData.id} className="p-4 border rounded-xl hover:border-[#2969FF]/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#2969FF]/10 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-[#2969FF]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-[#0F0F0F]">
                                  {userData.full_name || userData.email}
                                </h4>
                                <Badge 
                                  className={`${status.color === 'green' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                                >
                                  {status.text}
                                </Badge>
                                {hasExpiredRole && (
                                  <Badge className="bg-orange-100 text-orange-700">
                                    Role Expired
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-[#0F0F0F]/60">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {userData.email}
                                </span>
                                {role && (
                                  <span className="flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    {role.display_name} (Level {role.level})
                                  </span>
                                )}
                                {userData.user_role_assignments?.[0]?.expires_at && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Expires {new Date(userData.user_role_assignments[0].expires_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOtpModal({ open: true, userId: userData.id })}
                              className="rounded-xl"
                            >
                              <Smartphone className="w-3 h-3 mr-1" />
                              OTP
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUserModal({ open: true, user: userData, mode: 'edit' })}
                              className="rounded-xl"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUserModal({ open: true, user: userData, mode: 'view' })}
                              className="rounded-xl"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Sessions Tab */}
        <TabsContent value="sessions">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Active User Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{session.profiles?.full_name}</p>
                          <p className="text-xs text-[#0F0F0F]/60">{session.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-[#0F0F0F]/60" />
                          <div>
                            <p className="text-sm">{session.device_info || 'Unknown'}</p>
                            <p className="text-xs text-[#0F0F0F]/60">{session.ip_address}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#0F0F0F]/60" />
                          <span className="text-sm">{session.location || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(session.last_activity).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(session.expires_at).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => terminateSession(session.id, 'admin_terminated')}
                          className="rounded-xl text-red-600"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Terminate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Audit Tab */}
        <TabsContent value="audit">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Security Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 border rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getRiskLevel(log)}>
                          {log.risk_level.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{log.event_type.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">{log.event_category}</Badge>
                      </div>
                      <span className="text-sm text-[#0F0F0F]/60">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#0F0F0F]/80 mb-2">{log.description}</p>
                    <div className="flex items-center gap-4 text-xs text-[#0F0F0F]/60">
                      <span>User: {log.profiles?.email || 'System'}</span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                      {log.resource_type && <span>Resource: {log.resource_type}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Threats Tab */}
        <TabsContent value="threats">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Security Threats & Failed Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {failedAttempts.map((attempt) => (
                  <div key={attempt.id} className="p-4 border border-red-200 rounded-xl bg-red-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-red-800">Failed Login Attempt</span>
                        {attempt.is_blocked && (
                          <Badge className="bg-red-100 text-red-700">BLOCKED</Badge>
                        )}
                      </div>
                      <span className="text-sm text-red-600">
                        {new Date(attempt.last_attempt).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Email:</strong> {attempt.email || 'Unknown'}</p>
                        <p><strong>IP Address:</strong> {attempt.ip_address}</p>
                      </div>
                      <div>
                        <p><strong>Attempts:</strong> {attempt.attempt_count}</p>
                        <p><strong>First Attempt:</strong> {new Date(attempt.first_attempt).toLocaleString()}</p>
                      </div>
                    </div>
                    {attempt.reason && (
                      <p className="text-sm text-red-700 mt-2">
                        <strong>Reason:</strong> {attempt.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Modal - Add/Edit User */}
      <Dialog open={userModal.open} onOpenChange={(open) => setUserModal({ ...userModal, open })}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#2969FF]" />
              {userModal.mode === 'create' ? 'Add Admin User' : userModal.mode === 'edit' ? 'Edit User' : 'User Details'}
            </DialogTitle>
          </DialogHeader>
          
          {userModal.mode === 'create' ? (
            <AddUserForm 
              roles={roles} 
              onSuccess={() => {
                setUserModal({ open: false, user: null, mode: 'view' });
                loadData();
              }}
              onCancel={() => setUserModal({ open: false, user: null, mode: 'view' })}
            />
          ) : userModal.mode === 'edit' ? (
            <EditUserForm 
              user={userModal.user}
              roles={roles}
              onSuccess={() => {
                setUserModal({ open: false, user: null, mode: 'view' });
                loadData();
              }}
              onCancel={() => setUserModal({ open: false, user: null, mode: 'view' })}
            />
          ) : (
            <ViewUserDetails user={userModal.user} roles={roles} />
          )}
        </DialogContent>
      </Dialog>

      {/* OTP Modal */}
      <Dialog open={otpModal.open} onOpenChange={(open) => setOtpModal({ ...otpModal, open })}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#2969FF]" />
              OTP Management
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-[#0F0F0F]/60">
              Send a one-time password to this user's phone for verification.
            </p>
            <Button 
              onClick={() => {
                alert('OTP functionality requires Termii integration to be configured.');
                setOtpModal({ open: false, userId: null });
              }}
              className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
            >
              <Phone className="w-4 h-4 mr-2" />
              Send OTP
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add User Form Component
function AddUserForm({ roles, onSuccess, onCancel }) {
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !selectedRole) {
      alert('Please fill in email and select a role');
      return;
    }

    setLoading(true);
    try {
      // Find user by email
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single();

      if (findError || !profile) {
        alert('User not found. They must have a Ticketrack account first.');
        setLoading(false);
        return;
      }

      // Update user to be admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: true, admin_role: selectedRole })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Assign role
      const { error: roleError } = await supabase
        .from('user_role_assignments')
        .upsert({
          user_id: profile.id,
          role_id: selectedRole,
          assigned_by: user?.id,
          expires_at: expiresAt || null,
          reason: reason || 'Admin assignment',
          is_active: true
        });

      if (roleError) throw roleError;

      // Log the action
      await supabase.from('security_audit_logs').insert({
        user_id: user?.id,
        event_type: 'admin_user_created',
        event_category: 'admin',
        description: `Added ${email} as admin with role`,
        resource_type: 'user',
        resource_id: profile.id,
        risk_level: 'medium',
        success: true
      });

      alert('Admin user added successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add admin user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>User Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10 rounded-xl"
            required
          />
        </div>
        <p className="text-xs text-[#0F0F0F]/60">
          User must already have a Ticketrack account
        </p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <span>{role.display_name}</span>
                  <span className="text-xs text-[#0F0F0F]/60">(Level {role.level})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Expires At (Optional)</Label>
        <Input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-xl"
        />
        <p className="text-xs text-[#0F0F0F]/60">
          Leave empty for no expiration
        </p>
      </div>

      <div className="space-y-2">
        <Label>Reason</Label>
        <Input
          type="text"
          placeholder="Why is this user being added?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
        >
          {loading ? 'Adding...' : 'Add User'}
        </Button>
      </div>
    </form>
  );
}

// Edit User Form Component
function EditUserForm({ user: editUser, roles, onSuccess, onCancel }) {
  const [selectedRole, setSelectedRole] = useState(editUser?.user_role_assignments?.[0]?.role_id || '');
  const [expiresAt, setExpiresAt] = useState(editUser?.user_role_assignments?.[0]?.expires_at?.split('T')[0] || '');
  const [isActive, setIsActive] = useState(editUser?.user_role_assignments?.[0]?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Update role assignment
      const { error } = await supabase
        .from('user_role_assignments')
        .upsert({
          user_id: editUser.id,
          role_id: selectedRole,
          assigned_by: user?.id,
          expires_at: expiresAt || null,
          is_active: isActive
        });

      if (error) throw error;

      // Log the action
      await supabase.from('security_audit_logs').insert({
        user_id: user?.id,
        event_type: 'admin_user_updated',
        event_category: 'admin',
        description: `Updated admin user ${editUser.email}`,
        resource_type: 'user',
        resource_id: editUser.id,
        risk_level: 'medium',
        success: true
      });

      alert('User updated successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="p-3 bg-[#F4F6FA] rounded-xl">
        <p className="font-medium">{editUser?.full_name || editUser?.email}</p>
        <p className="text-sm text-[#0F0F0F]/60">{editUser?.email}</p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.display_name} (Level {role.level})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Expires At</Label>
        <Input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

// View User Details Component
function ViewUserDetails({ user: viewUser, roles }) {
  const role = roles.find(r => r.id === viewUser?.user_role_assignments?.[0]?.role_id);
  
  return (
    <div className="space-y-4 py-4">
      <div className="p-4 bg-[#F4F6FA] rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#2969FF]/10 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-[#2969FF]" />
          </div>
          <div>
            <h3 className="font-semibold">{viewUser?.full_name || 'No Name'}</h3>
            <p className="text-sm text-[#0F0F0F]/60">{viewUser?.email}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between p-3 border rounded-xl">
          <span className="text-[#0F0F0F]/60">Role</span>
          <span className="font-medium">{role?.display_name || 'No Role'}</span>
        </div>
        <div className="flex justify-between p-3 border rounded-xl">
          <span className="text-[#0F0F0F]/60">Level</span>
          <span className="font-medium">{role?.level || '-'}</span>
        </div>
        <div className="flex justify-between p-3 border rounded-xl">
          <span className="text-[#0F0F0F]/60">Status</span>
          <Badge className={viewUser?.user_role_assignments?.[0]?.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
            {viewUser?.user_role_assignments?.[0]?.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex justify-between p-3 border rounded-xl">
          <span className="text-[#0F0F0F]/60">Expires</span>
          <span className="font-medium">
            {viewUser?.user_role_assignments?.[0]?.expires_at 
              ? new Date(viewUser.user_role_assignments[0].expires_at).toLocaleDateString()
              : 'Never'}
          </span>
        </div>
        <div className="flex justify-between p-3 border rounded-xl">
          <span className="text-[#0F0F0F]/60">Created</span>
          <span className="font-medium">
            {viewUser?.created_at ? new Date(viewUser.created_at).toLocaleDateString() : '-'}
          </span>
        </div>
      </div>

      {role && (
        <div className="p-4 bg-[#F4F6FA] rounded-xl">
          <h4 className="font-medium mb-2">Permissions</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {role.can_create_users && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Create Users</span>}
            {role.can_modify_roles && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Modify Roles</span>}
            {role.can_access_finance && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Access Finance</span>}
            {role.can_process_payouts && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Process Payouts</span>}
            {role.can_approve_refunds && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Approve Refunds</span>}
            {role.can_manage_events && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Manage Events</span>}
            {role.can_manage_organizers && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> Manage Organizers</span>}
            {role.can_view_reports && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> View Reports</span>}
          </div>
        </div>
      )}
    </div>
  );
}