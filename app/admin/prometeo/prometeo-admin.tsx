'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, Play, Pause, Trash2, Plus, RefreshCw, Bell, Calendar, Bot, Mail,
  AlertCircle, AlertTriangle, Info, Zap, Eye, X
} from 'lucide-react';

type TaskType = 'scheduled' | 'conditional';
type NotificationType = 'in_app' | 'push' | 'email' | 'push_and_email' | 'all';
type Priority = 'info' | 'warning' | 'critical';

interface PrometeoTask {
  id: string;
  agent_id: string;
  agent_name?: string;
  prompt: string;
  schedule: string;
  next_run: string;
  is_active: boolean;
  task_type: TaskType;
  condition?: string;
  check_interval?: string;
  priority: Priority;
  notification_type: NotificationType;
  recipients: string[];
  created_at: string;
  last_run?: string;
  last_result?: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Props {
  tenantId: string;
}

export default function PrometeoAdmin({ tenantId }: Props) {
  const [tasks, setTasks] = useState<PrometeoTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch('/api/prometeo/tasks'),
        fetch('/api/agents')
      ]);
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleTask = async (taskId: string, isActive: boolean) => {
    try {
      await fetch(`/api/prometeo/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, is_active: !isActive } : t));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await fetch(`/api/prometeo/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      const res = await fetch(`/api/prometeo/tasks/${taskId}/run`, { method: 'POST' });
      if (res.ok) {
        alert('Tarea ejecutada. Revisa las notificaciones.');
        fetchData();
      }
    } catch (err) {
      console.error('Error running task:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prometeo</h1>
          <p className="text-gray-500 mt-1">Tareas programadas y alertas condicionales</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay tareas configuradas</h3>
            <p className="text-gray-500 mb-4">Crea tareas programadas o alertas condicionales</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Crear Primera Tarea
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id, task.is_active)}
                onDelete={() => deleteTask(task.id)}
                onRunNow={() => runTaskNow(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          agents={agents}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, onRunNow }: { 
  task: PrometeoTask; onToggle: () => void; onDelete: () => void; onRunNow: () => void;
}) {
  const isConditional = task.task_type === 'conditional';
  
  const priorityStyles = {
    info: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  };
  
  const PriorityIcon = task.priority === 'critical' ? AlertCircle 
    : task.priority === 'warning' ? AlertTriangle : Info;
  
  const styles = priorityStyles[task.priority || 'info'];

  return (
    <div className={`p-5 ${!task.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Bot className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-900">{task.agent_name || 'Agente'}</span>
            
            <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
              isConditional ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {isConditional ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {isConditional ? 'Condicional' : 'Programada'}
            </span>
            
            <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${styles.bg} ${styles.color}`}>
              <PriorityIcon className="w-3 h-3" />
              {task.priority === 'critical' ? 'Crítica' : task.priority === 'warning' ? 'Advertencia' : 'Info'}
            </span>
            
            <span className={`px-2 py-0.5 rounded text-xs ${
              task.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {task.is_active ? 'Activa' : 'Pausada'}
            </span>
          </div>

          {/* Content */}
          {isConditional && task.condition && (
            <div className="mb-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Condición:</strong> {task.condition}
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.prompt}</p>
          
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {isConditional 
                ? `Verificar: ${task.check_interval || '*/15 * * * *'}`
                : `Cron: ${task.schedule}`
              }
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Próx: {new Date(task.next_run).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {task.recipients?.length || 0} destinatarios
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onRunNow}
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Ejecutar ahora"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${
              task.is_active 
                ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' 
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            }`}
            title={task.is_active ? 'Pausar' : 'Activar'}
          >
            {task.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({ agents, onClose, onCreated }: {
  agents: Agent[]; onClose: () => void; onCreated: () => void;
}) {
  const [taskType, setTaskType] = useState<TaskType>('scheduled');
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('0 9 * * 1-5');
  const [condition, setCondition] = useState('');
  const [checkInterval, setCheckInterval] = useState('*/15 * * * *');
  const [priority, setPriority] = useState<Priority>('info');
  const [notificationType, setNotificationType] = useState<NotificationType>('in_app');
  const [recipients, setRecipients] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/prometeo/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          prompt,
          task_type: taskType,
          schedule: taskType === 'scheduled' ? schedule : null,
          condition: taskType === 'conditional' ? condition : null,
          check_interval: taskType === 'conditional' ? checkInterval : null,
          priority,
          notification_type: notificationType,
          recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear tarea');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Tarea Prometeo</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Agent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agente</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar agente...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Tarea</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTaskType('scheduled')}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  taskType === 'scheduled'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Clock className="w-5 h-5 mb-1" />
                <div className="font-medium">Programada</div>
                <div className="text-xs text-gray-500">Se ejecuta en horarios fijos</div>
              </button>
              <button
                type="button"
                onClick={() => setTaskType('conditional')}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  taskType === 'conditional'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Zap className="w-5 h-5 mb-1" />
                <div className="font-medium">Condicional</div>
                <div className="text-xs text-gray-500">Alerta si se cumple condición</div>
              </button>
            </div>
          </div>

          {/* Scheduled: Cron */}
          {taskType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horario (Cron)</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                placeholder="0 9 * * 1-5"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Ej: 0 9 * * 1-5 = Lunes a viernes a las 9am</p>
            </div>
          )}

          {/* Conditional: Condition */}
          {taskType === 'conditional' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condición (lenguaje natural)</label>
                <textarea
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={2}
                  placeholder="Las ventas del día son menores a $100.000"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">El agente evaluará esta condición y solo notificará si se cumple</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verificar cada</label>
                <select
                  value={checkInterval}
                  onChange={(e) => setCheckInterval(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="*/15 * * * *">Cada 15 minutos</option>
                  <option value="0 * * * *">Cada hora</option>
                  <option value="0 */4 * * *">Cada 4 horas</option>
                  <option value="0 9 * * *">Una vez al día (9am)</option>
                </select>
              </div>
            </>
          )}

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contexto / Instrucciones</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Genera un resumen de las ventas del día..."
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prioridad</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as Priority[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    priority === p
                      ? p === 'critical' ? 'border-red-500 bg-red-50 text-red-700'
                        : p === 'warning' ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p === 'critical' ? 'Crítica' : p === 'warning' ? 'Advertencia' : 'Info'}
                </button>
              ))}
            </div>
          </div>

          {/* Notification Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notificar por</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'in_app', label: 'In-App' },
                { value: 'push', label: 'Push' },
                { value: 'email', label: 'Email' },
                { value: 'all', label: 'Todos' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNotificationType(opt.value as NotificationType)}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                    notificationType === opt.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destinatarios</label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="email1@example.com, email2@example.com"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Separar emails con coma</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creando...' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
