import { useState, type KeyboardEvent } from 'react'

interface Props {
  onSubmit:    (question: string) => void
  disabled:    boolean
  placeholder?: string
}

export function QueryInput({ onSubmit, disabled, placeholder }: Props) {
  const [value, setValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSubmit(value.trim())
        setValue('')
      }
    }
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white">
      <div className="flex gap-2 items-end">
        <textarea
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder={placeholder || 'Ask about this codebase... (Enter to send, Shift+Enter for newline)'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
        />
        <button
          onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue('') } }}
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed h-10"
        >
          Send
        </button>
      </div>
    </div>
  )
}
