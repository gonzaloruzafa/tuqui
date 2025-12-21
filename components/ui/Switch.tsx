'use client'

interface SwitchProps {
    name: string
    defaultChecked?: boolean
    label?: string
    value?: string
}

export function Switch({ name, defaultChecked = false, label, value }: SwitchProps) {
    return (
        <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
                type="checkbox"
                name={name}
                className="sr-only peer"
                defaultChecked={defaultChecked}
                value={value}
            />
            <div className="
                after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all 
                peer-checked:bg-adhoc-violet
            "></div>
            {label && <span className="ml-3 text-sm font-medium text-gray-700">{label}</span>}
        </label>
    )
}
