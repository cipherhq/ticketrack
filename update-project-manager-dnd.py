#!/usr/bin/env python3
"""
Ticketrack Project Manager - Add Drag & Drop Kanban
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

content = '''import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  CalendarDays, X, Check, Columns, ListTodo, Timer, GripVertical
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
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ==================== CONSTANTS ====================

const PHASES = {
  pre_event: { label: 'Pre-Event', color: 'bg-blue-500', bgLight: 'bg-blue-50 border-blue-200', textColor: 'text-blue-600' },
  during_event: { label: 'During Event', color: 'bg-green-500', bgLight: 'bg-green-50 border-green-200', textColor: 'text-green-600' },
  post_event: { label: 'Post-Event', color: 'bg-purple-500', bgLight: 'bg-purple-50 border-purple-200', textColor: 'text-purple-600' },
};

const PRIORITIES = {
  low: { label: 'Low', color: 'text-gray-500 bg-gray-100', dotColor: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'text-blue-600 bg-blue-100', dotColor: 'bg-blue-500' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-100', dotColor: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-100', dotColor: 'bg-red-500' },
};

const STATUSES = {
  pending: { label: 'To Do', icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100', headerBg: 'bg-gray-50' },
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

// ==================== SORTABLE TASK CARD ====================

function SortableTaskCard({ task, onEdit, onStatusChange, onDelete, subtasksCount, commentsCount }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dueDateStatus = getDueDateStatus(task.due_date);
  const StatusIcon = STATUSES[task.status]?.icon || Circle;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-3 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-[#2969FF]' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[#F4F6FA] touch-none"
        >
          <GripVertical className="w-4 h-4 text-[#0F0F0F]/30" />
        </button>

        {/* Task content */}
        <div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
          <div className="flex items-start justify-between gap-2 cursor-pointer">
            <p className={`font-medium text-sm ${
              task.status === 'completed' ? 'line-through text-[#0F0F0F]/40' : 'text-[#0F0F0F]'
            }`}>
              {task.title}
            </p>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F4F6FA]">
                  <MoreHorizontal className="w-4 h-4 text-[#0F0F0F]/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(STATUSES).map(([key, status]) => (
                  <DropdownMenuItem 
                    key={key}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, key); }}
                  >
                    <status.icon className={`w-4 h-4 mr-2 ${status.color}`} />
                    {status.label}
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
            {/* Priority */}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITIES[task.priority]?.color}`}>
              {PRIORITIES[task.priority]?.label}
            </span>

            {/* Labels */}
            {task.labels?.map(labelId => {
              const label = LABELS.find(l => l.id === labelId);
              return label ? (
                <span key={labelId} className={`w-2 h-2 rounded-full ${label.color}`} title={label.name} />
              ) : null;
            })}

            {/* Due date */}
            {task.due_date && (
              <span className={`flex items-center gap-0.5 text-[10px] ${
                dueDateStatus === 'overdue' ? 'text-red-600 font-medium' :
                dueDateStatus === 'today' ? 'text-orange-600' :
                'text-[#0F0F0F]/50'
              }`}>
                <CalendarDays className="w-3 h-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}

            {/* Assignee */}
            {task.assigned_member && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#0F0F0F]/50">
                <User className="w-3 h-3" />
                {task.assigned_member.name?.split(' ')[0]}
              </span>
            )}

            {/* Subtasks */}
            {subtasksCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#0F0F0F]/50">
                <CheckSquare className="w-3 h-3" />
                {subtasksCount}
              </span>
            )}

            {/* Comments */}
            {commentsCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-[#0F0F0F]/50">
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

// Helper function
function getDueDateStatus(dueDate) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (isPast(date) && !isToday(date)) return 'overdue';
  if (isToday(date)) return 'today';
  if (differenceInDays(date, new Date()) <= 3) return 'upcoming';
  return 'normal';
}

// ==================== MAIN COMPONENT ====================

export function ProjectManager() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [comments, setComments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  
  // UI state
  const [expandedEvents, setExpandedEvents] = useState({});
  const [viewMode, setViewMode] = useState('kanban');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Task modal state
  const [showAddTask, setShowAddTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Drag state
  const [activeId, setActiveId] = useState(null);
  
  // Form state
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

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
        supabase
          .from('events')
          .select('id, title, start_date, end_date, status, currency')
          .eq('organizer_id', organizer.id)
          .order('start_date', { ascending: true }),
        supabase
          .from('event_tasks')
          .select('*, assigned_member:organizer_team_members(id, name, email)')
          .eq('organizer_id', organizer.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('organizer_team_members')
          .select('id, name, email, role')
          .eq('organizer_id', organizer.id)
          .eq('status', 'active'),
        supabase
          .from('task_templates')
          .select('*')
          .or(`is_global.eq.true,organizer_id.eq.${organizer.id}`)
          .order('sort_order', { ascending: true }),
        supabase
          .from('task_comments')
          .select('*, author:profiles(full_name, avatar_url)')
          .eq('organizer_id', organizer.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_subtasks')
          .select('*')
          .eq('organizer_id', organizer.id)
          .order('sort_order', { ascending: true }),
      ]);

      setEvents(eventsRes.data || []);
      setTasks(tasksRes.data || []);
      setTeamMembers(teamRes.data || []);
      setTemplates(templatesRes.data || []);
      setComments(commentsRes.data || []);
      setSubtasks(subtasksRes.data || []);

      // Auto-expand upcoming events
      const upcoming = {};
      eventsRes.data?.forEach(e => {
        if (isAfter(new Date(e.start_date), new Date()) || 
            differenceInDays(new Date(e.start_date), new Date()) > -7) {
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

  // ==================== TASK HELPERS ====================

  const getEventTasks = (eventId) => tasks.filter(t => t.event_id === eventId);
  const getTasksByPhase = (eventId, phase) => getEventTasks(eventId).filter(t => t.phase === phase);
  const getTasksByStatus = (eventId, status) => getEventTasks(eventId).filter(t => t.status === status);
  const getTaskSubtasks = (taskId) => subtasks.filter(s => s.task_id === taskId);
  const getTaskComments = (taskId) => comments.filter(c => c.task_id === taskId);

  const getEventProgress = (eventId) => {
    const eventTasks = getEventTasks(eventId);
    if (eventTasks.length === 0) return 0;
    const completed = eventTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / eventTasks.length) * 100);
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
    if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus);
    if (filterAssignee !== 'all') filtered = filtered.filter(t => t.assigned_to === filterAssignee);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return filtered;
  };

  // ==================== DRAG & DROP ====================

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    // Check if dropped on a status column
    if (Object.keys(STATUSES).includes(newStatus)) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== newStatus) {
        await updateTaskStatus(taskId, newStatus);
      }
    }
  };

  const handleDragOver = (event) => {
    // Optional: Add visual feedback during drag
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
      alert('Task title is required');
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
        assigned_to: taskForm.assigned_to || null,
        estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
        labels: taskForm.labels,
        updated_at: new Date().toISOString(),
      };

      if (editingTask) {
        const { error } = await supabase
          .from('event_tasks')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) throw error;
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
      } else {
        const eventId = showAddTask;
        const { data, error } = await supabase
          .from('event_tasks')
          .insert({
            ...taskData,
            event_id: eventId,
            organizer_id: organizer.id,
            sort_order: getEventTasks(eventId).length,
          })
          .select('*, assigned_member:organizer_team_members(id, name, email)')
          .single();

        if (error) throw error;
        setTasks([...tasks, data]);
      }

      closeTaskModal();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task');
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

      const { error } = await supabase
        .from('event_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) {
        // Revert on error
        loadData();
        throw error;
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const { error } = await supabase
        .from('event_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
      closeTaskModal();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  // ==================== SUBTASK ACTIONS ====================

  const addSubtask = async (taskId) => {
    if (!newSubtask.trim()) return;
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .insert({
          task_id: taskId,
          organizer_id: organizer.id,
          title: newSubtask.trim(),
          is_completed: false,
          sort_order: getTaskSubtasks(taskId).length,
        })
        .select()
        .single();

      if (error) throw error;
      setSubtasks([...subtasks, data]);
      setNewSubtask('');
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const toggleSubtask = async (subtaskId, isCompleted) => {
    try {
      const { error } = await supabase
        .from('task_subtasks')
        .update({ is_completed: !isCompleted })
        .eq('id', subtaskId);

      if (error) throw error;
      setSubtasks(subtasks.map(s => s.id === subtaskId ? { ...s, is_completed: !isCompleted } : s));
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      const { error } = await supabase
        .from('task_subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  // ==================== COMMENT ACTIONS ====================

  const addComment = async (taskId) => {
    if (!newComment.trim()) return;
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          organizer_id: organizer.id,
          author_id: organizer.user_id,
          content: newComment.trim(),
        })
        .select('*, author:profiles(full_name, avatar_url)')
        .single();

      if (error) throw error;
      setComments([data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const applyTemplates = async (eventId) => {
    if (templates.length === 0) {
      alert('No templates available');
      return;
    }

    setSaving(true);
    try {
      const existingTasks = getEventTasks(eventId);
      const newTasks = templates
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
      alert(`Added ${data.length} tasks from templates`);
    } catch (error) {
      console.error('Error applying templates:', error);
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER KANBAN BOARD ====================

  const renderKanbanBoard = (eventId) => {
    const filteredTasks = getFilteredTasks(eventId);
    const activeTask = tasks.find(t => t.id === activeId);

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
          {Object.entries(STATUSES).map(([statusKey, status]) => {
            const statusTasks = filteredTasks.filter(t => t.status === statusKey);
            
            return (
              <div key={statusKey} className="min-w-[260px]" id={statusKey}>
                {/* Column Header */}
                <div className={`p-3 rounded-t-xl ${status.headerBg} border border-b-0 border-[#0F0F0F]/10`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <status.icon className={`w-4 h-4 ${status.color}`} />
                      <span className="font-medium text-sm">{status.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {statusTasks.length}
                    </Badge>
                  </div>
                </div>
                
                {/* Column Content - Droppable Area */}
                <SortableContext
                  items={statusTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                  id={statusKey}
                >
                  <div 
                    className="bg-[#F8F9FB] rounded-b-xl p-2 min-h-[400px] space-y-2 border border-t-0 border-[#0F0F0F]/10"
                    data-status={statusKey}
                  >
                    {statusTasks.map(task => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onEdit={openTaskModal}
                        onStatusChange={updateTaskStatus}
                        onDelete={deleteTask}
                        subtasksCount={getTaskSubtasks(task.id).length}
                        commentsCount={getTaskComments(task.id).length}
                      />
                    ))}
                    
                    {/* Add Task Button */}
                    {statusKey === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-[#0F0F0F]/40 hover:text-[#0F0F0F] hover:bg-white border-2 border-dashed border-[#0F0F0F]/10"
                        onClick={() => openTaskModal(null, eventId)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Task
                      </Button>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="p-3 rounded-xl border bg-white shadow-xl opacity-90">
              <p className="font-medium text-sm">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // ==================== RENDER TASK CARD (for list view) ====================

  const renderTaskCard = (task) => {
    const dueDateStatus = getDueDateStatus(task.due_date);
    const taskSubtasks = getTaskSubtasks(task.id);
    const completedSubtasks = taskSubtasks.filter(s => s.is_completed).length;
    const StatusIcon = STATUSES[task.status]?.icon || Circle;

    return (
      <div
        key={task.id}
        className={`group p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
          task.status === 'completed' 
            ? 'bg-green-50/50 border-green-200' 
            : 'bg-white border-[#0F0F0F]/10 hover:border-[#2969FF]/30'
        }`}
        onClick={() => openTaskModal(task)}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed');
            }}
            className="mt-0.5"
          >
            <StatusIcon className={`w-5 h-5 ${STATUSES[task.status]?.color}`} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`font-medium text-sm ${
                task.status === 'completed' ? 'line-through text-[#0F0F0F]/40' : 'text-[#0F0F0F]'
              }`}>
                {task.title}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITIES[task.priority]?.color}`}>
                {PRIORITIES[task.priority]?.label}
              </span>

              <span className={`px-2 py-0.5 rounded text-xs ${PHASES[task.phase]?.bgLight} ${PHASES[task.phase]?.textColor}`}>
                {PHASES[task.phase]?.label}
              </span>

              {task.due_date && (
                <span className={`flex items-center gap-1 text-xs ${
                  dueDateStatus === 'overdue' ? 'text-red-600' : 'text-[#0F0F0F]/60'
                }`}>
                  <CalendarDays className="w-3 h-3" />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              )}

              {task.assigned_member && (
                <span className="flex items-center gap-1 text-xs text-[#0F0F0F]/60">
                  <User className="w-3 h-3" />
                  {task.assigned_member.name?.split(' ')[0]}
                </span>
              )}

              {taskSubtasks.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#0F0F0F]/60">
                  <CheckSquare className="w-3 h-3" />
                  {completedSubtasks}/{taskSubtasks.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== LOADING STATE ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // ==================== MAIN RENDER ====================

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
              className={`p-2 transition-colors ${viewMode === 'timeline' ? 'bg-[#2969FF] text-white' : 'bg-white hover:bg-[#F4F6FA]'}`}
              title="Timeline View"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-[#2969FF] text-white' : 'bg-white hover:bg-[#F4F6FA]'}`}
              title="Kanban Board"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#2969FF] text-white' : 'bg-white hover:bg-[#F4F6FA]'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{events.length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Circle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{tasks.filter(t => t.status === 'pending').length}</p>
                <p className="text-xs text-[#0F0F0F]/60">To Do</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{tasks.filter(t => t.status === 'in_progress').length}</p>
                <p className="text-xs text-[#0F0F0F]/60">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-xs text-[#0F0F0F]/60">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed').length}
                </p>
                <p className="text-xs text-[#0F0F0F]/60">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="All Phases" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Phases</SelectItem>
            {Object.entries(PHASES).map(([key, phase]) => (
              <SelectItem key={key} value={key}>{phase.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {teamMembers.length > 0 && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="">Unassigned</SelectItem>
              {teamMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Events */}
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
                        <p className="text-sm font-medium">{progress}%</p>
                        <p className="text-xs text-[#0F0F0F]/60">
                          {eventTasks.filter(t => t.status === 'completed').length}/{eventTasks.length} tasks
                        </p>
                      </div>
                      <div className="w-24 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2969FF] transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-[#0F0F0F]/10 p-4">
                    {viewMode === 'kanban' ? (
                      renderKanbanBoard(event.id)
                    ) : (
                      <div className="space-y-2">
                        {getFilteredTasks(event.id).length === 0 ? (
                          <p className="text-center text-[#0F0F0F]/40 py-8">No tasks yet</p>
                        ) : (
                          getFilteredTasks(event.id).map(task => renderTaskCard(task))
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => openTaskModal(null, event.id)} className="rounded-xl">
                            <Plus className="w-4 h-4 mr-1" /> Add Task
                          </Button>
                          {eventTasks.length === 0 && (
                            <Button variant="outline" size="sm" onClick={() => applyTemplates(event.id)} className="rounded-xl">
                              <LayoutGrid className="w-4 h-4 mr-1" /> Apply Templates
                            </Button>
                          )}
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
            <DialogTitle className="flex items-center gap-2">
              {editingTask ? <><Edit2 className="w-5 h-5 text-[#2969FF]" /> Edit Task</> : <><Plus className="w-5 h-5 text-[#2969FF]" /> New Task</>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                className="rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details..."
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="rounded-xl min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={taskForm.phase} onValueChange={(v) => setTaskForm({ ...taskForm, phase: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PHASES).map(([key, phase]) => (
                      <SelectItem key={key} value={key}>{phase.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PRIORITIES).map(([key, priority]) => (
                      <SelectItem key={key} value={key}>{priority.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(STATUSES).map(([key, status]) => (
                      <SelectItem key={key} value={key}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="">Unassigned</SelectItem>
                      {teamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Estimated Hours</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g., 2.5"
                  value={taskForm.estimated_hours}
                  onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-2">
                {LABELS.map(label => {
                  const isSelected = taskForm.labels?.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => {
                        const newLabels = isSelected
                          ? taskForm.labels.filter(l => l !== label.id)
                          : [...(taskForm.labels || []), label.id];
                        setTaskForm({ ...taskForm, labels: newLabels });
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected ? `${label.color} text-white` : 'bg-[#F4F6FA] text-[#0F0F0F]/60 hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtasks */}
            {editingTask && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><ListTodo className="w-4 h-4" /> Subtasks</Label>
                <div className="space-y-2">
                  {getTaskSubtasks(editingTask.id).map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-2 p-2 bg-[#F4F6FA] rounded-lg">
                      <button onClick={() => toggleSubtask(subtask.id, subtask.is_completed)}>
                        {subtask.is_completed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />}
                      </button>
                      <span className={`flex-1 text-sm ${subtask.is_completed ? 'line-through text-[#0F0F0F]/40' : ''}`}>{subtask.title}</span>
                      <button onClick={() => deleteSubtask(subtask.id)} className="text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a subtask..."
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSubtask(editingTask.id)}
                      className="rounded-xl flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => addSubtask(editingTask.id)} className="rounded-xl"><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            )}

            {/* Comments */}
            {editingTask && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Comments</Label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(editingTask.id)}
                      className="rounded-xl flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => addComment(editingTask.id)} className="rounded-xl">Send</Button>
                  </div>
                  {getTaskComments(editingTask.id).length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {getTaskComments(editingTask.id).map(comment => (
                        <div key={comment.id} className="p-3 bg-[#F4F6FA] rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{comment.author?.full_name || 'Unknown'}</span>
                            <span className="text-xs text-[#0F0F0F]/40">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            {editingTask && (
              <Button variant="outline" onClick={() => deleteTask(editingTask.id)} className="rounded-xl text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={closeTaskModal} className="rounded-xl">Cancel</Button>
              <Button onClick={saveTask} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTask ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'''

def main():
    filepath = os.path.join(BASE_DIR, "src/pages/organizer/ProjectManager.jsx")
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print("✅ Updated ProjectManager.jsx with drag-and-drop Kanban")
    print()
    print("Features:")
    print("- Drag tasks between columns to change status")
    print("- Grip handle on left side of each task card")
    print("- Visual feedback during drag")
    print("- Optimistic updates for smooth UX")

if __name__ == "__main__":
    main()
