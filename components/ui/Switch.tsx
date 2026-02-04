'use client'

import { useState, useEffect } from 'react'

interface SwitchProps {
    name: string
    defaultChecked?: boolean
    label?: string
    value?: string
    disabled?: boolean
    onChange?: (checked: boolean) => void
}

export function Switch({ name, defaultChecked = false, label, value, disabled = false, onChange }: SwitchProps) {
    const [checked, setChecked] = useState(defaultChecked)
    
    // Sync state with prop when it changes (fixes bug with Server Components)
    useEffect(() => {
        setChecked(defaultChecked)
    }, [defaultChecked])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return
        const newChecked = e.target.checked
        setChecked(newChecked)
        onChange?.(newChecked)
    }

    return (
        <label className={`relative inline-flex items-center select-none gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            {/* For multi-value fields (like tools), only include when checked */}
            {value ? (
                // Multi-value mode: only send if checked
                checked && <input type="hidden" name={name} value={value} />
            ) : (
                // Boolean mode: send on/off
                <input type="hidden" name={name} value={checked ? 'on' : 'off'} />
            )}
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={handleChange}
                disabled={disabled}
            />
            <div className={`
                w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
                ${checked ? 'bg-adhoc-violet' : 'bg-gray-200'}
                relative
            `}>
                <div className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
                    transition-transform duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `} />
            </div>
            {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
        </label>
    )
}
