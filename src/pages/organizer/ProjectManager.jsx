import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Calendar, CheckSquare, Plus, Loader2, Clock, Users,
  ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle,
  LayoutGrid, List, Filter, Search
} from 'lucide-react';

import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';

const PHASES = {
  pre_event: { label: 'Pre-Event', color: 'bg-blue-500', bgLight: 'bg-blue-50 border-blue-200' },
  during_event: { label: 'During Event', color: 'bg-green-500', bgLight: 'bg-green-50 border-green-200' },
  post_event: { label: 'Post-Event', color: 'bg-purple-500', bgLight: 'bg-purple-50 border-purple-200' },
};

const PRIORITIES = {
  low: { label: 'Low', color: 'text-gray-500 bg-gray-100' },
  medium: { label: 'Medium', color: 'text-blue-600 bg-blue-100' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-100' },
};

const STATUS_ICONS = {
  pending: <Circle className="w-4 h-4 text-gray-400" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  cancelled: <AlertCircle className="w-4 h-4 text-gray-400" />,
};

export function ProjectManager() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [viewMode, setViewMode] = useState('timeline'); // timeline, list
  const [filterPhase, setFilterPhase] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTask, setShowAddTask] = useState(null); // event_id or null
  const [newTask, setNewTask] = useState({ title: '', phase: 'pre_event', priority: 'medium', due_date: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organizer?.id) loadData();
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, status, currency')
        .eq('organizer_id', organizer.id)
        .order('start_date', { ascending: true });

      // Load tasks
      const { data: tasksData } = await supabase
        .from('event_tasks')
        .select('*, assigned_member:organizer_team_members(id, name, email)')
        .eq('organizer_id', organizer.id)
        .order('sort_order', { ascending: true });

      // Load team members
      const { data: teamData } = await supabase
        .from('organizer_team_members')
        .select('id, name, email, role')
        .eq('organizer_id', organizer.id)
        .eq('status', 'active');

      // Load templates
      const { data: templatesData } = await supabase
        .from('task_templates')
        .select('*')
        .or(`is_global.eq.true,organizer_id.eq.${organizer.id}`)
        .order('sort_order', { ascending: true });

      setEvents(eventsData || []);
      setTasks(tasksData || []);
      setTeamMembers(teamData || []);
      setTemplates(templatesData || []);

      // Auto-expand upcoming events
      const upcoming = {};
      eventsData?.forEach(e => {
        if (isAfter(new Date(e.start_date), new Date()) || 
            differenceInDays(new Date(e.start_date), new Date()) > -7) {
          upcoming[e.id] = true;
        }
      });
      setExpandedEvents(upcoming);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const getEventTasks = (eventId) => {
    return tasks.filter(t => t.event_id === eventId);
  };

  const getTasksByPhase = (eventId, phase) => {
    return getEventTasks(eventId).filter(t => t.phase === phase);
  };

  const getEventProgress = (eventId) => {
    const eventTasks = getEventTasks(eventId);
    if (eventTasks.length === 0) return 0;
    const completed = eventTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / eventTasks.length) * 100);
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const { error } = await supabase
        .from('event_tasks')
        .update({ 
          status: newStatus, 
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
          completed_by: newStatus === 'completed' ? organizer.user_id : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === task.id ? { 
        ...t, 
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      } : t));
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const addTask = async (eventId) => {
    if (!newTask.title.trim()) {
      alert('Task title is required');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('event_tasks')
        .insert({
          event_id: eventId,
          organizer_id: organizer.id,
          title: newTask.title,
          phase: newTask.phase,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          status: 'pending',
          sort_order: getEventTasks(eventId).length,
        })
        .select()
        .single();

      if (error) throw error;

      setTasks([...tasks, data]);
      setShowAddTask(null);
      setNewTask({ title: '', phase: 'pre_event', priority: 'medium', due_date: '' });
      alert('Task added');
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task');
    } finally {
      setSaving(false);
    }
  };

  const applyTemplates = async (eventId, phase = null) => {
    const templatesToApply = templates.filter(t => !phase || t.phase === phase);
    if (templatesToApply.length === 0) {
      alert('No templates available');
      return;
    }

    setSaving(true);
    try {
      const existingTasks = getEventTasks(eventId);
      const newTasks = templatesToApply
        .filter(t => !existingTasks.some(et => et.title === t.title && et.phase === t.phase))
        .map((t, i) => ({
          event_id: eventId,
          organizer_id: organizer.id,
          title: t.title,
          description: t.description,
          phase: t.phase,
          priority: 'medium',
          status: 'pending',
          sort_order: existingTasks.length + i,
        }));

      if (newTasks.length === 0) {
        alert('All templates already applied');
        return;
      }

      const { data, error } = await supabase
        .from('event_tasks')
        .insert(newTasks)
        .select();

      if (error) throw error;

      setTasks([...tasks, ...data]);
      toast.success(`Added ${data.length} tasks from templates`);
    } catch (error) {
      console.error('Error applying templates:', error);
      alert('Failed to apply templates');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('event_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter(t => t.id !== taskId));
      alert('Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const getEventPhase = (event) => {
    const now = new Date();
    const start = new Date(event.start_date);
    const end = new Date(event.end_date || event.start_date);
    
    if (isBefore(now, start)) return 'pre_event';
    if (isAfter(now, end)) return 'post_event';
    return 'during_event';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">Project Manager</h1>
          <p className="text-[#0F0F0F]/60">Track tasks and timelines for all your events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl w-64"
            />
          </div>
          <div className="flex rounded-xl border border-[#0F0F0F]/10 overflow-hidden">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 ${viewMode === 'timeline' ? 'bg-[#2969FF] text-white' : 'bg-white'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[#2969FF] text-white' : 'bg-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{events.length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Completed Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Pending Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{teamMembers.length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Timeline */}
      {events.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-3" />
            <p className="text-[#0F0F0F]/60 mb-4">No events yet</p>
            <Button
              onClick={() => navigate('/organizer/events/create')}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const progress = getEventProgress(event.id);
            const currentPhase = getEventPhase(event);
            const isExpanded = expandedEvents[event.id];
            const eventTasks = getEventTasks(event.id);

            return (
              <Card key={event.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
                {/* Event Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-[#F4F6FA]/50 transition-colors"
                  onClick={() => setExpandedEvents({ ...expandedEvents, [event.id]: !isExpanded })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[#0F0F0F]/40" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#0F0F0F]/40" />
                      )}
                      <div>
                        <h3 className="font-medium text-[#0F0F0F]">{event.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-[#0F0F0F]/60">
                          <span>{format(new Date(event.start_date), 'MMM d, yyyy')}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${PHASES[currentPhase].bgLight} border`}>
                            {PHASES[currentPhase].label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{progress}% Complete</p>
                        <p className="text-xs text-[#0F0F0F]/60">{eventTasks.filter(t => t.status === 'completed').length}/{eventTasks.length} tasks</p>
                      </div>
                      <div className="w-24 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2969FF] transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-[#0F0F0F]/10">
                    {/* Phase Tabs */}
                    <div className="flex border-b border-[#0F0F0F]/10">
                      {Object.entries(PHASES).map(([key, phase]) => {
                        const phaseTasks = getTasksByPhase(event.id, key);
                        const completed = phaseTasks.filter(t => t.status === 'completed').length;
                        return (
                          <button
                            key={key}
                            onClick={() => setFilterPhase(filterPhase === key ? 'all' : key)}
                            className={`flex-1 p-3 text-sm font-medium border-b-2 transition-colors ${
                              filterPhase === key || filterPhase === 'all'
                                ? 'border-[#2969FF] text-[#2969FF]'
                                : 'border-transparent text-[#0F0F0F]/60 hover:text-[#0F0F0F]'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${phase.color}`} />
                              {phase.label}
                              <span className="text-xs bg-[#F4F6FA] px-2 py-0.5 rounded-full">
                                {completed}/{phaseTasks.length}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tasks List */}
                    <div className="p-4 space-y-4">
                      {Object.entries(PHASES).map(([phaseKey, phase]) => {
                        if (filterPhase !== 'all' && filterPhase !== phaseKey) return null;
                        const phaseTasks = getTasksByPhase(event.id, phaseKey);

                        return (
                          <div key={phaseKey} className="space-y-2">
                            {filterPhase === 'all' && (
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${phase.color}`} />
                                <span className="text-sm font-medium text-[#0F0F0F]/60">{phase.label}</span>
                              </div>
                            )}
                            {phaseTasks.length === 0 ? (
                              <p className="text-sm text-[#0F0F0F]/40 pl-4">No tasks in this phase</p>
                            ) : (
                              phaseTasks.map((task) => (
                                <div
                                  key={task.id}
                                  className={`flex items-center gap-3 p-3 rounded-xl ${
                                    task.status === 'completed' ? 'bg-green-50' : 'bg-[#F4F6FA]'
                                  }`}
                                >
                                  <button onClick={() => toggleTaskStatus(task)}>
                                    {STATUS_ICONS[task.status]}
                                  </button>
                                  <div className="flex-1">
                                    <p className={`text-sm ${task.status === 'completed' ? 'line-through text-[#0F0F0F]/40' : ''}`}>
                                      {task.title}
                                    </p>
                                    {task.due_date && (
                                      <p className="text-xs text-[#0F0F0F]/40">
                                        Due: {format(new Date(task.due_date), 'MMM d')}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs ${PRIORITIES[task.priority]?.color}`}>
                                    {PRIORITIES[task.priority]?.label}
                                  </span>
                                  <button
                                    onClick={() => deleteTask(task.id)}
                                    className="text-red-500 hover:text-red-600 p-1"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      })}

                      {/* Add Task */}
                      {showAddTask === event.id ? (
                        <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
                          <Input
                            placeholder="Task title..."
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            className="rounded-xl"
                            autoFocus
                          />
                          <div className="grid grid-cols-3 gap-3">
                            <select
                              value={newTask.phase}
                              onChange={(e) => setNewTask({ ...newTask, phase: e.target.value })}
                              className="px-3 py-2 rounded-xl border border-[#0F0F0F]/10 text-sm"
                            >
                              {Object.entries(PHASES).map(([key, phase]) => (
                                <option key={key} value={key}>{phase.label}</option>
                              ))}
                            </select>
                            <select
                              value={newTask.priority}
                              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                              className="px-3 py-2 rounded-xl border border-[#0F0F0F]/10 text-sm"
                            >
                              {Object.entries(PRIORITIES).map(([key, p]) => (
                                <option key={key} value={key}>{p.label}</option>
                              ))}
                            </select>
                            <Input
                              type="date"
                              value={newTask.due_date}
                              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                              className="rounded-xl text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddTask(null)}
                              className="rounded-xl"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => addTask(event.id)}
                              disabled={saving}
                              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                            >
                              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Task'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddTask(event.id)}
                            className="rounded-xl"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Task
                          </Button>
                          {eventTasks.length === 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyTemplates(event.id)}
                              disabled={saving}
                              className="rounded-xl"
                            >
                              <LayoutGrid className="w-4 h-4 mr-1" />
                              Apply Checklist Templates
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
