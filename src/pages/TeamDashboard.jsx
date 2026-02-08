import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, Calendar, CheckSquare, Users, QrCode, 
  Building, ChevronRight, Clock, CheckCircle2, Circle,
  LogOut, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

const ROLE_PERMISSIONS = {
  owner: ['events', 'tasks', 'checkin', 'analytics', 'team', 'settings'],
  manager: ['events', 'tasks', 'checkin', 'analytics', 'team'],
  coordinator: ['tasks', 'checkin'],
  staff: ['checkin'],
};

const ROLE_LABELS = {
  owner: 'Owner',
  manager: 'Manager',
  coordinator: 'Coordinator',
  staff: 'Staff',
};

export function TeamDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(null);
  const [organizer, setOrganizer] = useState(null);
  const [events, setEvents] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [stats, setStats] = useState({ totalTasks: 0, completedTasks: 0, upcomingEvents: 0 });

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Get team membership
      const { data: memberData, error: memberError } = await supabase
        .from('organizer_team_members')
        .select('*, organizer:organizers(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (memberError || !memberData) {
        // Not a team member, redirect
        navigate('/');
        return;
      }

      setMembership(memberData);
      setOrganizer(memberData.organizer);

      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, status, venue_name')
        .eq('organizer_id', memberData.organizer_id)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);

      setEvents(eventsData || []);

      // Load tasks assigned to me or all tasks if manager+
      const taskQuery = supabase
        .from('event_tasks')
        .select('*, event:events(title)')
        .eq('organizer_id', memberData.organizer_id)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(10);

      if (memberData.role === 'coordinator' || memberData.role === 'staff') {
        taskQuery.eq('assigned_to', memberData.id);
      }

      const { data: tasksData } = await taskQuery;
      setMyTasks(tasksData || []);

      // Get stats
      const { count: totalTasks } = await supabase
        .from('event_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organizer_id', memberData.organizer_id);

      const { count: completedTasks } = await supabase
        .from('event_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organizer_id', memberData.organizer_id)
        .eq('status', 'completed');

      setStats({
        totalTasks: totalTasks || 0,
        completedTasks: completedTasks || 0,
        upcomingEvents: eventsData?.length || 0,
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await supabase
        .from('event_tasks')
        .update({ 
          status: newStatus, 
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          completed_by: newStatus === 'completed' ? user.id : null 
        })
        .eq('id', task.id);

      setMyTasks(myTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      if (newStatus === 'completed') {
        setStats({ ...stats, completedTasks: stats.completedTasks + 1 });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const hasPermission = (permission) => {
    if (!membership) return false;
    return ROLE_PERMISSIONS[membership.role]?.includes(permission);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2969FF] flex items-center justify-center text-white font-bold">
              T
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{organizer?.business_name}</h1>
              <p className="text-xs text-muted-foreground">
                {membership?.name} • <span className="text-[#2969FF]">{ROLE_LABELS[membership?.role]}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Welcome, {membership?.name}!</h2>
          <p className="text-muted-foreground">Here's what's happening with your events</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.upcomingEvents}</p>
                  <p className="text-xs text-muted-foreground">Upcoming Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{myTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Pending Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.completedTasks}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">
                    {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {hasPermission('checkin') && (
            <Button
              onClick={() => navigate('/team/check-in')}
              className="h-20 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-2xl flex flex-col items-center justify-center gap-2"
            >
              <QrCode className="w-6 h-6" />
              <span>Check-In</span>
            </Button>
          )}
          {hasPermission('tasks') && (
            <Button
              onClick={() => navigate('/team/tasks')}
              variant="outline"
              className="h-20 rounded-2xl flex flex-col items-center justify-center gap-2"
            >
              <CheckSquare className="w-6 h-6" />
              <span>My Tasks</span>
            </Button>
          )}
          {hasPermission('events') && (
            <Button
              onClick={() => navigate('/team/events')}
              variant="outline"
              className="h-20 rounded-2xl flex flex-col items-center justify-center gap-2"
            >
              <Calendar className="w-6 h-6" />
              <span>Events</span>
            </Button>
          )}
          {hasPermission('team') && (
            <Button
              onClick={() => navigate('/organizer/team')}
              variant="outline"
              className="h-20 rounded-2xl flex flex-col items-center justify-center gap-2"
            >
              <Users className="w-6 h-6" />
              <span>Team</span>
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* My Tasks */}
          {hasPermission('tasks') && (
            <Card className="border-border/10 rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#2969FF]" />
                  My Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending tasks</p>
                ) : (
                  <div className="space-y-2">
                    {myTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-muted/70 cursor-pointer"
                        onClick={() => toggleTask(task)}
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{task.event?.title}</p>
                        </div>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    ))}
                    {myTasks.length > 5 && (
                      <Button
                        variant="ghost"
                        className="w-full text-[#2969FF]"
                        onClick={() => navigate('/team/tasks')}
                      >
                        View all tasks
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2969FF]" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-xl bg-muted hover:bg-muted/70 cursor-pointer"
                      onClick={() => hasPermission('checkin') && navigate(`/team/check-in/${event.id}`)}
                    >
                      <h4 className="font-medium text-foreground">{event.title}</h4>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(event.start_date), 'MMM d, yyyy')}
                        </span>
                        {event.venue_name && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {event.venue_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
