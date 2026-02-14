import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { sendTaskAssignedEmail } from '@/lib/emailService';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { 
  Calendar, CheckSquare, Plus, Loader2, Clock, Users,
  ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle,
  LayoutGrid, List, Search, Edit2, Trash2, MessageSquare,
  User, MoreHorizontal, AlertTriangle,
  CalendarDays, X, Columns, ListTodo, GripVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, isAfter, isBefore, differenceInDays, isPast, isToday } from 'date-fns';

// Drag and Drop
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

// ==================== CONSTANTS ====================

const PHASES = {
  pre_event: { label: 'Pre-Event', color: 'bg-blue-500', bgLight: 'bg-blue-50 border-blue-200', textColor: 'text-blue-600' },
  during_event: { label: 'During Event', color: 'bg-green-500', bgLight: 'bg-green-50 border-green-200', textColor: 'text-green-600' },
  post_event: { label: 'Post-Event', color: 'bg-purple-500', bgLight: 'bg-purple-50 border-purple-200', textColor: 'text-purple-600' },
};

const PRIORITIES = {
  low: { label: 'Low', color: 'text-muted-foreground bg-muted', dotColor: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600 bg-blue-100', dotColor: 'bg-blue-500' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-100', dotColor: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-100', dotColor: 'bg-red-500' },
};

const STATUSES = {
  pending: { label: 'To Do', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted', headerBg: 'bg-background' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100', headerBg: 'bg-blue-50' },
  completed: { label: 'Done', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100', headerBg: 'bg-green-50' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100', headerBg: 'bg-red-50' },
};

const LABELS = [
  { id: 'design', name: 'Design', color: 'bg-pink-500' },
  { id: 'marketing', name: 'Marketing', color: 'bg-purple-500' },
  { id: 'logistics', name: 'Logistics', color: 'bg-orange-500' },
  { id: 'finance', name: 'Finance', color: 'bg-green-500' },
  { id: 'vendor', name: 'Vendor', color: 'bg-blue-500' },
  { id: 'tech', name: 'Tech', color: 'bg-cyan-500' },
  { id: 'catering', name: 'Catering', color: 'bg-amber-500' },
  { id: 'security', name: 'Security', color: 'bg-red-500' },
];

// Helper function
function getDueDateStatus(dueDate) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (isPast(date) && !isToday(date)) return 'overdue';
  if (isToday(date)) return 'today';
  if (differenceInDays(date, new Date()) <= 3) return 'upcoming';
  return 'normal';
}

// ==================== DROPPABLE COLUMN ====================

function DroppableColumn({ id, status, children, taskCount, onAddTask }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  return (
    <div className="min-w-[260px] flex flex-col">
      {/* Column Header */}
      <div className={`p-3 rounded-t-xl ${status.headerBg} border border-b-0 border-border/10`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <status.icon className={`w-4 h-4 ${status.color}`} />
            <span className="font-medium text-sm">{status.label}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{taskCount}</Badge>
        </div>
      </div>
      
      {/* Column Content */}
      <div 
        ref={setNodeRef}
        className={`flex-1 rounded-b-xl p-2 min-h-[400px] space-y-2 border border-t-0 transition-colors ${
          isOver ? 'bg-[#2969FF]/10 border-[#2969FF]/30' : 'bg-[#F8F9FB] border-border/10'
        }`}
      >
        {children}
        
        {id === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground hover:bg-card border-2 border-dashed border-border/10"
            onClick={onAddTask}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>
        )}
      </div>
    </div>
  );
}

// ==================== DRAGGABLE TASK CARD ====================

function DraggableTaskCard({ task, onEdit, onStatusChange, onDelete, subtasksCount, commentsCount }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const dueDateStatus = getDueDateStatus(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-3 rounded-xl border bg-card shadow-sm transition-all ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-[#2969FF]' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted touch-none"
        >
          <GripVertical className="w-4 h-4 text-foreground/30" />
        </button>

        {/* Task content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium text-sm ${
              task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}>
              {task.title}
            </p>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(STATUSES).map(([key, s]) => (
                  <DropdownMenuItem 
                    key={key}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, key); }}
                  >
                    <s.icon className={`w-4 h-4 mr-2 ${s.color}`} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITIES[task.priority]?.color}`}>
              {PRIORITIES[task.priority]?.label}
            </span>

            {task.labels?.map(labelId => {
              const label = LABELS.find(l => l.id === labelId);
              return label ? (
                <span key={labelId} className={`w-2 h-2 rounded-full ${label.color}`} title={label.name} />
              ) : null;
            })}

            {task.due_date && (
              <span className={`flex items-center gap-0.5 text-[10px] ${
                dueDateStatus === 'overdue' ? 'text-red-600 font-medium' :
                dueDateStatus === 'today' ? 'text-orange-600' :
                'text-muted-foreground'
              }`}>
                <CalendarDays className="w-3 h-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}

            {task.assigned_member && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <User className="w-3 h-3" />
                {task.assigned_member.name?.split(' ')[0]}
              </span>
            )}

            {subtasksCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <CheckSquare className="w-3 h-3" />
                {subtasksCount}
              </span>
            )}

            {commentsCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MessageSquare className="w-3 h-3" />
                {commentsCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function ProjectManager() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  
  const [expandedEvents, setExpandedEvents] = useState({});
  const [viewMode, setViewMode] = useState('kanban');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddTask, setShowAddTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [activeTask, setActiveTask] = useState(null);
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    phase: 'pre_event',
    priority: 'medium',
    status: 'pending',
    due_date: '',
    assigned_to: '',
    estimated_hours: '',
    labels: [],
  });
  
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ==================== DATA LOADING ====================

  useEffect(() => {
    if (organizer?.id) loadData();
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, tasksRes, teamRes, templatesRes, commentsRes, subtasksRes] = await Promise.all([
        supabase.from('events').select('id, title, start_date, end_date, status, currency').eq('organizer_id', organizer.id).order('start_date', { ascending: true }),
        supabase.from('event_tasks').select('*, assigned_member:organizer_team_members(id, name, email)').eq('organizer_id', organizer.id).order('sort_order', { ascending: true }),
        supabase.from('organizer_team_members').select('id, name, email, role').eq('organizer_id', organizer.id).in('status', ['active', 'pending']),
        supabase.from('task_templates').select('*').or(`is_global.eq.true,organizer_id.eq.${organizer.id}`).order('sort_order', { ascending: true }),
        supabase.from('task_comments').select('*, author:profiles(full_name, avatar_url)').eq('organizer_id', organizer.id).order('created_at', { ascending: false }),
        supabase.from('task_subtasks').select('*').eq('organizer_id', organizer.id).order('sort_order', { ascending: true }),
      ]);

      setEvents(eventsRes.data || []);
      setTasks(tasksRes.data || []);
      setTeamMembers(teamRes.data || []);
      setTemplates(templatesRes.data || []);
      setComments(commentsRes.data || []);
      setSubtasks(subtasksRes.data || []);

      const upcoming = {};
      eventsRes.data?.forEach(e => {
        if (isAfter(new Date(e.start_date), new Date()) || differenceInDays(new Date(e.start_date), new Date()) > -7) {
          upcoming[e.id] = true;
        }
      });
      setExpandedEvents(upcoming);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== HELPERS ====================

  const getEventTasks = (eventId) => tasks.filter(t => t.event_id === eventId);
  const getTasksByPhase = (eventId, phase) => getEventTasks(eventId).filter(t => t.phase === phase);
  const getTaskSubtasks = (taskId) => subtasks.filter(s => s.task_id === taskId);
  const getTaskComments = (taskId) => comments.filter(c => c.task_id === taskId);

  const getEventProgress = (eventId) => {
    const eventTasks = getEventTasks(eventId);
    if (eventTasks.length === 0) return 0;
    return Math.round((eventTasks.filter(t => t.status === 'completed').length / eventTasks.length) * 100);
  };

  const getEventPhase = (event) => {
    const now = new Date();
    const start = new Date(event.start_date);
    const end = new Date(event.end_date || event.start_date);
    if (isBefore(now, start)) return 'pre_event';
    if (isAfter(now, end)) return 'post_event';
    return 'during_event';
  };

  const getFilteredTasks = (eventId) => {
    let filtered = getEventTasks(eventId);
    if (filterPhase !== 'all') filtered = filtered.filter(t => t.phase === filterPhase);
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') {
        filtered = filtered.filter(t => !t.assigned_to);
      } else {
        filtered = filtered.filter(t => t.assigned_to === filterAssignee);
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return filtered;
  };

  // ==================== DRAG & DROP ====================

  const handleDragStart = (event) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    // Check if dropped on a valid status column
    if (Object.keys(STATUSES).includes(newStatus)) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== newStatus) {
        await updateTaskStatus(taskId, newStatus);
      }
    }
  };

  // ==================== TASK ACTIONS ====================

  const openTaskModal = (task = null, eventId = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title || '',
        description: task.description || '',
        phase: task.phase || 'pre_event',
        priority: task.priority || 'medium',
        status: task.status || 'pending',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        assigned_to: task.assigned_to || '',
        estimated_hours: task.estimated_hours || '',
        labels: task.labels || [],
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '', description: '', phase: 'pre_event', priority: 'medium',
        status: 'pending', due_date: '', assigned_to: '', estimated_hours: '', labels: [],
      });
    }
    setShowAddTask(eventId);
    setTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setTaskModalOpen(false);
    setEditingTask(null);
    setShowAddTask(null);
    setNewComment('');
    setNewSubtask('');
  };

  const saveTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setSaving(true);
    try {
      const taskData = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        phase: taskForm.phase,
        priority: taskForm.priority,
        status: taskForm.status,
        due_date: taskForm.due_date || null,
        assigned_to: taskForm.assigned_to && taskForm.assigned_to !== 'unassigned' ? taskForm.assigned_to : null,
        estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
        labels: taskForm.labels,
        updated_at: new Date().toISOString(),
      };

      if (editingTask) {
        const { error } = await supabase.from('event_tasks').update(taskData).eq('id', editingTask.id);
        if (error) throw error;
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
        
        // Send email if assignee changed to a new person
        if (taskForm.assigned_to && taskForm.assigned_to !== editingTask.assigned_to) {
          const assignee = teamMembers.find(m => m.id === taskForm.assigned_to);
          const event = events.find(e => e.id === editingTask.event_id);
          if (assignee?.email) {
            try {
              await sendTaskAssignedEmail(assignee.email, {
                assigneeName: assignee.name || assignee.email,
                assignerName: organizer.name || organizer.business_name,
                taskTitle: taskForm.title,
                description: taskForm.description,
                eventTitle: event?.title || 'Event',
                priority: PRIORITIES[taskForm.priority]?.label || taskForm.priority,
                dueDate: taskForm.due_date ? format(new Date(taskForm.due_date), 'MMM d, yyyy') : null,
                eventId: editingTask.event_id,
              }, organizer.id);
            } catch (emailErr) {
              console.log('Task reassignment email failed:', emailErr);
            }
          }
        }
      } else {
        const eventId = showAddTask;
        const { data, error } = await supabase.from('event_tasks').insert({
          ...taskData,
          event_id: eventId,
          organizer_id: organizer.id,
          sort_order: getEventTasks(eventId).length,
        }).select('*, assigned_member:organizer_team_members(id, name, email)').single();
        if (error) throw error;
        setTasks([...tasks, data]);
        
        // Send email if task is assigned
        if (data.assigned_to && data.assigned_member?.email) {
          const event = events.find(e => e.id === eventId);
          try {
            await sendTaskAssignedEmail(data.assigned_member.email, {
              assigneeName: data.assigned_member.name || data.assigned_member.email,
              assignerName: organizer.name || organizer.business_name,
              taskTitle: data.title,
              description: data.description,
              eventTitle: event?.title || 'Event',
              priority: PRIORITIES[data.priority]?.label || data.priority,
              dueDate: data.due_date ? format(new Date(data.due_date), 'MMM d, yyyy') : null,
              eventId: eventId,
            }, organizer.id);
          } catch (emailErr) {
            console.log('Task assignment email failed:', emailErr);
          }
        }
      }
      closeTaskModal();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        completed_by: newStatus === 'completed' ? organizer.user_id : null,
      };

      // Optimistic update
      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));

      const { error } = await supabase.from('event_tasks').update(updates).eq('id', taskId);
      if (error) {
        loadData(); // Revert on error
        throw error;
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!(await confirm('Delete Task', 'Delete this task?', { variant: 'destructive' }))) return;
    try {
      const { error } = await supabase.from('event_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
      closeTaskModal();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // ==================== SUBTASK & COMMENT ACTIONS ====================

  const addSubtask = async (taskId) => {
    if (!newSubtask.trim()) return;
    try {
      const { data, error } = await supabase.from('task_subtasks').insert({
        task_id: taskId, organizer_id: organizer.id, title: newSubtask.trim(),
        is_completed: false, sort_order: getTaskSubtasks(taskId).length,
      }).select().single();
      if (error) throw error;
      setSubtasks([...subtasks, data]);
      setNewSubtask('');
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const toggleSubtask = async (subtaskId, isCompleted) => {
    try {
      await supabase.from('task_subtasks').update({ is_completed: !isCompleted }).eq('id', subtaskId);
      setSubtasks(subtasks.map(s => s.id === subtaskId ? { ...s, is_completed: !isCompleted } : s));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await supabase.from('task_subtasks').delete().eq('id', subtaskId);
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const addComment = async (taskId) => {
    if (!newComment.trim()) return;
    try {
      const { data, error } = await supabase.from('task_comments').insert({
        task_id: taskId, organizer_id: organizer.id, author_id: organizer.user_id, content: newComment.trim(),
      }).select('*, author:profiles(full_name, avatar_url)').single();
      if (error) throw error;
      setComments([data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const applyTemplates = async (eventId) => {
    if (templates.length === 0) return toast.info('No templates available');
    setSaving(true);
    try {
      const existingTasks = getEventTasks(eventId);
      const newTasks = templates
        .filter(t => !existingTasks.some(et => et.title === t.title && et.phase === t.phase))
        .map((t, i) => ({
          event_id: eventId, organizer_id: organizer.id, title: t.title, description: t.description,
          phase: t.phase, priority: 'medium', status: 'pending', sort_order: existingTasks.length + i,
        }));
      if (newTasks.length === 0) return toast.info('All templates already applied');
      const { data, error } = await supabase.from('event_tasks').insert(newTasks).select();
      if (error) throw error;
      setTasks([...tasks, ...data]);
      toast.success(`Added ${data.length} tasks`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER KANBAN ====================

  const renderKanbanBoard = (eventId) => {
    const filteredTasks = getFilteredTasks(eventId);

    return (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(STATUSES).map(([statusKey, status]) => {
            const statusTasks = filteredTasks.filter(t => t.status === statusKey);
            
            return (
              <DroppableColumn
                key={statusKey}
                id={statusKey}
                status={status}
                taskCount={statusTasks.length}
                onAddTask={() => openTaskModal(null, eventId)}
              >
                {statusTasks.map(task => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    onEdit={openTaskModal}
                    onStatusChange={updateTaskStatus}
                    onDelete={deleteTask}
                    subtasksCount={getTaskSubtasks(task.id).length}
                    commentsCount={getTaskComments(task.id).length}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="p-3 rounded-xl border-2 border-[#2969FF] bg-card shadow-2xl w-[240px]">
              <p className="font-medium text-sm">{activeTask.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${PRIORITIES[activeTask.priority]?.color}`}>
                  {PRIORITIES[activeTask.priority]?.label}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // ==================== RENDER LIST VIEW ====================

  const renderTaskCard = (task) => {
    const dueDateStatus = getDueDateStatus(task.due_date);
    const taskSubtasks = getTaskSubtasks(task.id);
    const completedSubtasks = taskSubtasks.filter(s => s.is_completed).length;
    const StatusIcon = STATUSES[task.status]?.icon || Circle;

    return (
      <div
        key={task.id}
        className={`group p-3 rounded-xl border cursor-pointer hover:shadow-md ${
          task.status === 'completed' ? 'bg-green-50/50 border-green-200' : 'bg-card border-border/10'
        }`}
        onClick={() => openTaskModal(task)}
      >
        <div className="flex items-start gap-3">
          <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed'); }}>
            <StatusIcon className={`w-5 h-5 ${STATUSES[task.status]?.color}`} />
          </button>
          <div className="flex-1">
            <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs ${PRIORITIES[task.priority]?.color}`}>{PRIORITIES[task.priority]?.label}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${PHASES[task.phase]?.bgLight} ${PHASES[task.phase]?.textColor}`}>{PHASES[task.phase]?.label}</span>
              {task.due_date && (
                <span className={`flex items-center gap-1 text-xs ${dueDateStatus === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <CalendarDays className="w-3 h-3" />{format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
              {task.assigned_member && <span className="text-xs text-muted-foreground"><User className="w-3 h-3 inline mr-1" />{task.assigned_member.name?.split(' ')[0]}</span>}
              {taskSubtasks.length > 0 && <span className="text-xs text-muted-foreground"><CheckSquare className="w-3 h-3 inline mr-1" />{completedSubtasks}/{taskSubtasks.length}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== LOADING ====================

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  // ==================== MAIN RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Project Manager</h1>
          <p className="text-muted-foreground">Track tasks and timelines for all your events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl w-64" />
          </div>
          <div className="flex rounded-xl border border-border/10 overflow-hidden">
            <button onClick={() => setViewMode('timeline')} className={`p-2 ${viewMode === 'timeline' ? 'bg-[#2969FF] text-white' : 'bg-card'}`}><Calendar className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('kanban')} className={`p-2 ${viewMode === 'kanban' ? 'bg-[#2969FF] text-white' : 'bg-card'}`}><Columns className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-[#2969FF] text-white' : 'bg-card'}`}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Calendar, count: events.length, label: 'Events', bg: 'bg-blue-100', iconColor: 'text-blue-600' },
          { icon: Circle, count: tasks.filter(t => t.status === 'pending').length, label: 'To Do', bg: 'bg-muted', iconColor: 'text-muted-foreground' },
          { icon: Clock, count: tasks.filter(t => t.status === 'in_progress').length, label: 'In Progress', bg: 'bg-blue-100', iconColor: 'text-blue-600' },
          { icon: CheckCircle2, count: tasks.filter(t => t.status === 'completed').length, label: 'Completed', bg: 'bg-green-100', iconColor: 'text-green-600' },
          { icon: AlertTriangle, count: tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed').length, label: 'Overdue', bg: 'bg-red-100', iconColor: 'text-red-600' },
        ].map((stat, i) => (
          <Card key={i} className="border-border/10 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="All Phases" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Phases</SelectItem>
            {Object.entries(PHASES).map(([key, phase]) => <SelectItem key={key} value={key}>{phase.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {teamMembers.length > 0 && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="All Assignees" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No events yet</p>
            <Button onClick={() => navigate('/organizer/events/create')} className="bg-[#2969FF] text-white rounded-xl">
              <Plus className="w-4 h-4 mr-2" />Create Event
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
              <Card key={event.id} className="border-border/10 rounded-2xl overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setExpandedEvents({ ...expandedEvents, [event.id]: !isExpanded })}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                      <div>
                        <h3 className="font-medium">{event.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{format(new Date(event.start_date), 'MMM d, yyyy')}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${PHASES[currentPhase].bgLight} border`}>{PHASES[currentPhase].label}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{progress}%</p>
                        <p className="text-xs text-muted-foreground">{eventTasks.filter(t => t.status === 'completed').length}/{eventTasks.length}</p>
                      </div>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#2969FF]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/10 p-4">
                    {viewMode === 'kanban' ? renderKanbanBoard(event.id) : viewMode === 'timeline' ? (
                      // Timeline/Gantt View
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground border-b pb-2">
                          <div className="w-48 font-medium">Task</div>
                          <div className="flex-1 font-medium">Timeline</div>
                          <div className="w-20 font-medium text-center">Status</div>
                        </div>
                        {getFilteredTasks(event.id).length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No tasks</p>
                        ) : (
                          getFilteredTasks(event.id).map(task => {
                            const dueDateStatus = getDueDateStatus(task.due_date);
                            const StatusIcon = STATUSES[task.status]?.icon || Circle;
                            return (
                              <div key={task.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => openTaskModal(task)}>
                                <div className="w-48 truncate">
                                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                                  <p className="text-xs text-muted-foreground">{task.assigned_member?.name || 'Unassigned'}</p>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${PHASES[task.phase]?.bgLight} ${PHASES[task.phase]?.textColor} border`}>{PHASES[task.phase]?.label}</span>
                                    {task.due_date && (
                                      <span className={`flex items-center gap-1 text-xs ${dueDateStatus === 'overdue' ? 'text-red-600 font-medium' : dueDateStatus === 'today' ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                        <CalendarDays className="w-3 h-3" />
                                        {format(new Date(task.due_date), 'MMM d, yyyy')}
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded text-xs ${PRIORITIES[task.priority]?.color}`}>{PRIORITIES[task.priority]?.label}</span>
                                  </div>
                                </div>
                                <div className="w-20 flex justify-center">
                                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${STATUSES[task.status]?.bg}`}>
                                    <StatusIcon className={`w-3 h-3 ${STATUSES[task.status]?.color}`} />
                                    <span className={`text-xs ${STATUSES[task.status]?.color}`}>{STATUSES[task.status]?.label}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => openTaskModal(null, event.id)} className="rounded-xl"><Plus className="w-4 h-4 mr-1" />Add Task</Button>
                          {eventTasks.length === 0 && <Button variant="outline" size="sm" onClick={() => applyTemplates(event.id)} className="rounded-xl"><LayoutGrid className="w-4 h-4 mr-1" />Apply Templates</Button>}
                        </div>
                      </div>
                    ) : (
                      // List View
                      <div className="space-y-2">
                        {getFilteredTasks(event.id).length === 0 ? <p className="text-center text-muted-foreground py-8">No tasks</p> : getFilteredTasks(event.id).map(renderTaskCard)}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => openTaskModal(null, event.id)} className="rounded-xl"><Plus className="w-4 h-4 mr-1" />Add Task</Button>
                          {eventTasks.length === 0 && <Button variant="outline" size="sm" onClick={() => applyTemplates(event.id)} className="rounded-xl"><LayoutGrid className="w-4 h-4 mr-1" />Apply Templates</Button>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Modal */}
      <Dialog open={taskModalOpen} onOpenChange={closeTaskModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div><Label>Task Title *</Label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="rounded-xl mt-1" autoFocus /></div>
            <div><Label>Description</Label><Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="rounded-xl mt-1" /></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Phase</Label>
                <Select value={taskForm.phase} onValueChange={(v) => setTaskForm({ ...taskForm, phase: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{Object.entries(PHASES).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{Object.entries(PRIORITIES).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{Object.entries(STATUSES).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} className="rounded-xl mt-1" /></div>
              {teamMembers.length > 0 && (
                <div><Label>Assign To</Label>
                  <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent className="rounded-xl"><SelectItem value="unassigned">Unassigned</SelectItem>{teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Estimated Hours</Label><Input type="number" min="0" step="0.5" value={taskForm.estimated_hours} onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>

            <div><Label>Labels</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {LABELS.map(label => (
                  <button key={label.id} type="button" onClick={() => setTaskForm({ ...taskForm, labels: taskForm.labels?.includes(label.id) ? taskForm.labels.filter(l => l !== label.id) : [...(taskForm.labels || []), label.id] })}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${taskForm.labels?.includes(label.id) ? `${label.color} text-white` : 'bg-muted'}`}>{label.name}</button>
                ))}
              </div>
            </div>

            {editingTask && (
              <>
                <div><Label><ListTodo className="w-4 h-4 inline mr-2" />Subtasks</Label>
                  <div className="space-y-2 mt-2">
                    {getTaskSubtasks(editingTask.id).map(s => (
                      <div key={s.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <button onClick={() => toggleSubtask(s.id, s.is_completed)}>{s.is_completed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}</button>
                        <span className={`flex-1 text-sm ${s.is_completed ? 'line-through text-muted-foreground' : ''}`}>{s.title}</span>
                        <button onClick={() => deleteSubtask(s.id)} className="text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input placeholder="Add subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask(editingTask.id)} className="rounded-xl" />
                      <Button size="sm" variant="outline" onClick={() => addSubtask(editingTask.id)} className="rounded-xl"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>

                <div><Label><MessageSquare className="w-4 h-4 inline mr-2" />Comments</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-2">
                      <Input placeholder="Add comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment(editingTask.id)} className="rounded-xl" />
                      <Button size="sm" variant="outline" onClick={() => addComment(editingTask.id)} className="rounded-xl">Send</Button>
                    </div>
                    {getTaskComments(editingTask.id).map(c => (
                      <div key={c.id} className="p-3 bg-muted rounded-xl">
                        <div className="flex justify-between text-xs mb-1"><span className="font-medium">{c.author?.full_name || 'Unknown'}</span><span className="text-muted-foreground">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span></div>
                        <p className="text-sm">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            {editingTask && <Button variant="outline" onClick={() => deleteTask(editingTask.id)} className="rounded-xl text-red-600 border-red-200"><Trash2 className="w-4 h-4 mr-2" />Delete</Button>}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeTaskModal} className="rounded-xl">Cancel</Button>
              <Button onClick={saveTask} disabled={saving} className="bg-[#2969FF] text-white rounded-xl">{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{editingTask ? 'Save' : 'Create'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
