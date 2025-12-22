'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, Trash2, AlertTriangle, Info, AlertCircle, Filter } from 'lucide-react'

interface Notification {
    id: string
    title: string
    body: string
    priority: 'info' | 'warning' | 'critical'
    is_read: boolean
    link?: string
    agent_name?: string
    created_at: string
}

export default function NotificationsInbox() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread' | 'info' | 'warning' | 'critical'>('all')

    const fetchNotifications = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filter === 'unread') params.set('unread', 'true')
            else if (['info', 'warning', 'critical'].includes(filter)) params.set('priority', filter)
            
            const res = await fetch(`/api/notifications?${params}`)
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications || [])
            }
        } catch (e) {
            console.error('Failed to fetch notifications:', e)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => { fetchNotifications() }, [fetchNotifications])

    const markAsRead = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_read: true })
            })
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        } catch (e) {
            console.error('Failed to mark as read:', e)
        }
    }

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', { method: 'POST' })
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        } catch (e) {
            console.error('Failed to mark all as read:', e)
        }
    }

    const deleteNotification = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
            setNotifications(prev => prev.filter(n => n.id !== id))
        } catch (e) {
            console.error('Failed to delete notification:', e)
        }
    }

    const getPriorityStyles = (priority: string) => {
        switch (priority) {
            case 'critical':
                return { icon: AlertCircle, bgColor: 'bg-red-50', textColor: 'text-red-600', borderColor: 'border-red-200' }
            case 'warning':
                return { icon: AlertTriangle, bgColor: 'bg-amber-50', textColor: 'text-amber-600', borderColor: 'border-amber-200' }
            default:
                return { icon: Info, bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' }
        }
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
                    <p className="text-gray-500 mt-1">
                        {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Marcar todas leídas
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {[
                    { value: 'all', label: 'Todas' },
                    { value: 'unread', label: 'Sin leer' },
                    { value: 'critical', label: 'Críticas' },
                    { value: 'warning', label: 'Advertencias' },
                    { value: 'info', label: 'Info' },
                ].map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setFilter(opt.value as typeof filter)}
                        className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                            filter === opt.value
                                ? 'bg-purple-100 text-purple-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">Cargando...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay notificaciones</h3>
                        <p className="text-gray-500">Las alertas de Prometeo aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {notifications.map(notification => {
                            const styles = getPriorityStyles(notification.priority)
                            const Icon = styles.icon
                            
                            return (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-gray-50 transition-colors ${
                                        !notification.is_read ? styles.bgColor : ''
                                    }`}
                                >
                                    <div className="flex gap-4">
                                        <div className={`flex-shrink-0 p-2 rounded-lg ${styles.bgColor}`}>
                                            <Icon className={`w-5 h-5 ${styles.textColor}`} />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className={`font-medium ${notification.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-gray-500 mt-1">{notification.body}</p>
                                                </div>
                                                <span className="text-xs text-gray-400 flex-shrink-0">
                                                    {new Date(notification.created_at).toLocaleString('es-AR', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short'
                                                    })}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 mt-3">
                                                {!notification.is_read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                                    >
                                                        <Check className="w-3 h-3" /> Marcar leída
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
