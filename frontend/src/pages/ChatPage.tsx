// FILE: frontend/src/pages/ChatPage.tsx — REPLACE entire file
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useStreamQuery } from '../hooks/useStreamQuery'
import { useConversationList } from '../hooks/useConversationList'
import { CodeViewer } from '../components/CodeViewer/CodeViewer'
import { useAuth } from '../hooks/useAuth'
import { INTENT_MODES, type QueryIntent } from '../constants/queryIntents'

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000)  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function initials(email: string) {
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

import { AnswerRenderer, CitBadge } from '../components/ChatWindow/AnswerRenderer'

// ── Message bubble ────────────────────────────────────────────────

function MessageRow({
  role,
  content,
  citations,
  latencyMs,
  isHistory,
  isStreaming,
  userInitials,
}: {
  role:         'user' | 'assistant'
  content:      string
  citations?:   Record<string, any>
  latencyMs?:   number
  isHistory?:   boolean
  isStreaming?:  boolean
  userInitials: string
}) {
  const isUser = role === 'user'

  const avatarStyle: React.CSSProperties = {
    width:          '28px',
    height:         '28px',
    borderRadius:   '50%',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       '10px',
    fontWeight:     500,
    alignSelf:      'flex-end',
    background:     isUser ? '#534AB7' : '#EEEDFE',
    color:          isUser ? '#EEEDFE' : '#3C3489',
  }

  const bubbleStyle: React.CSSProperties = {
    maxWidth:     isUser ? '72%' : '88%',
    borderRadius: '14px',
    padding:      isUser ? '10px 14px' : '14px 16px',
    fontSize:     '13px',
    lineHeight:   '1.68',
    ...(isUser ? {
      background:          isHistory ? '#AFA9EC' : '#534AB7',
      color:               isHistory ? '#26215C' : '#EEEDFE',
      borderBottomRightRadius: '4px',
    } : {
      background:         'var(--color-background-secondary)',
      border:             '0.5px solid var(--color-border-tertiary)',
      color:              isHistory ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
      borderBottomLeftRadius: '4px',
      opacity:            isHistory ? 0.85 : 1,
    }),
  }

  const hasCitations = citations && Object.keys(citations).length > 0

  return (
    <div style={{
      display:        'flex',
      gap:            '10px',
      marginBottom:   '8px',
      alignItems:     'flex-end',
      flexDirection:  isUser ? 'row-reverse' : 'row',
    }}>
      <div style={avatarStyle}>
        {isUser ? userInitials : 'AI'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '72%' : '88%' }}>
        <div style={bubbleStyle}>
          {isStreaming && !content ? (
            <span style={{ display: 'flex', gap: '5px', alignItems: 'center', height: '18px' }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--color-text-tertiary)',
                  display: 'inline-block',
                  animation: `bob 0.7s ${i * 0.12}s infinite`,
                }} />
              ))}
            </span>
          ) : (
            <>
              <div>
                {role === 'assistant'
                  ? <AnswerRenderer text={content} citations={citations || {}} />
                  : <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
                }
                {isStreaming && (
                  <span style={{
                    display: 'inline-block', width: '2px', height: '13px',
                    background: 'var(--color-text-secondary)',
                    marginLeft: '2px', verticalAlign: 'middle',
                    animation: 'blink 1s infinite',
                  }} />
                )}
              </div>

              {hasCitations && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '0.5px solid var(--color-border-tertiary)',
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    marginBottom: '6px',
                  }}>
                    Source files
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {Object.entries(citations!)
                      .filter(([, c], idx, arr) =>
                        arr.findIndex(([, x]) => x.filePath === c.filePath) === idx
                      )
                      .slice(0, 8)
                      .map(([key, c]: any) => (
                        <CitBadge key={key} citKey={key} citation={c} />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          fontSize: '10px',
          color:    'var(--color-text-tertiary)',
          marginTop: '3px',
          display: 'flex',
          gap: '6px',
        }}>
          {latencyMs && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
          {hasCitations && (
            <span>
              {Object.values(citations!).filter((c: any) => c.verified).length} verified ·{' '}
              {Object.keys(citations!).length} citations
            </span>
          )}
          {isStreaming && <span>Generating...</span>}
        </div>
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────

function Divider({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0 10px' }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
      <span style={{
        fontSize:   '15px',
        color:      strong ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
        fontWeight: strong ? 500 : 400,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyState({
  hasConversations,
  intent,
  onPickPrompt,
}: {
  hasConversations: boolean
  intent:           QueryIntent
  onPickPrompt:     (prompt: string) => void
}) {
  const mode = INTENT_MODES.find(m => m.id === intent) || INTENT_MODES[1]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '12px',
      padding: '32px 24px',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: mode.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${mode.border}`,
        color: mode.color, fontSize: '13px', fontWeight: 600,
      }}>
        {mode.label.slice(0, 1)}
      </div>
      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
        {hasConversations ? 'Select a conversation' : `${mode.label} mode`}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', margin: 0, textAlign: 'center', maxWidth: '280px' }}>
        {hasConversations
          ? 'Pick a conversation from the sidebar, or start a new one below'
          : mode.description}
      </p>
      {!hasConversations && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          width: '100%', maxWidth: '420px', marginTop: '8px',
        }}>
          {mode.prompts.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPickPrompt(prompt)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: '12px',
                lineHeight: 1.45,
                color: mode.color,
                background: mode.bg,
                border: `1px solid ${mode.border}`,
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ChatPage ─────────────────────────────────────────────────

export function ChatPage() {
  const { repoId }       = useParams<{ repoId: string }>()
  const [searchParams]   = useSearchParams()
  const navigate         = useNavigate()
  const { logout, user } = useAuth()
  const bottomRef        = useRef<HTMLDivElement>(null)
  const textareaRef      = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft]           = useState('')
  const [intent, setIntent]         = useState<QueryIntent>('ARCHITECTURE')
  const [activeConvId, setActiveConvId] = useState<string | undefined>(
    searchParams.get('conversationId') || undefined
  )

  const {
    messages, isStreaming, error,
    askQuestion, clearMessages, setConversationId,
  } = useStreamQuery(repoId || '')

  const { conversations, loading: convLoading, reload: reloadConvs } =
    useConversationList(repoId || null)

  const userInitials = user ? initials(user.email) : 'U'

  // Restore conversation from URL on mount
  useEffect(() => {
    if (activeConvId) setConversationId(activeConvId)
  }, [activeConvId])

  // Refresh sidebar after message sent
  useEffect(() => {
    if (!isStreaming && messages.some(m => !m.isHistory)) reloadConvs()
  }, [isStreaming])

  // Auto scroll
  useEffect(() => {
  if (messages.length === 0) return
  const t = setTimeout(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, 80)  // ← wait 80ms for DOM to paint before scrolling
  return () => clearTimeout(t)
}, [messages.length, isStreaming]) 

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [draft])

  const handleSend = (override?: string) => {
    const q = (override ?? draft).trim()
    if (!q || isStreaming) return
    askQuestion(q, intent)
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleSelectConv = (convId: string) => {
    setActiveConvId(convId)
    setConversationId(convId)
    navigate(`/app/chat/${repoId}?conversationId=${convId}`, { replace: true })
  }

  const handleNewConv = () => {
    setActiveConvId(undefined)
    clearMessages()
    navigate(`/app/chat/${repoId}`, { replace: true })
  }

  // Find conversation title from first message or sidebar
  const convTitle = (() => {
    const firstUserMsg = messages.find(m => m.role === 'user')
    if (firstUserMsg) return firstUserMsg.content.slice(0, 48) + (firstUserMsg.content.length > 48 ? '...' : '')
    const sidebarConv = conversations.find(c => c.conversationId === activeConvId)
    if (sidebarConv) return sidebarConv.firstQuestion.slice(0, 48)
    return 'New conversation'
  })()

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--color-background-primary)',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '248px', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-secondary)',
        overflow: 'hidden',
      }}>

        {/* Brand + repo */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#534AB7', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Codebase Explainer
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 9px',
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: '8px',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.2" strokeLinecap="round">
              <rect x="1.5" y="1.5" width="11" height="11" rx="2"/>
              <path d="M4 4.5h6M4 7h3.5"/>
            </svg>
            <span style={{
              fontSize: '11px', fontFamily: 'monospace',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {repoId?.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Conversations list */}
        <div style={{
          padding: '8px 14px 4px',
          fontSize: '9px', fontWeight: 500, letterSpacing: '.08em',
          textTransform: 'uppercase', color: 'var(--color-text-tertiary)',
        }}>
          Conversations
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convLoading ? (
            <div style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              No conversations yet
            </div>
          ) : (
            conversations.map(conv => {
              const active = conv.conversationId === activeConvId
              return (
                <div
                  key={conv.conversationId}
                  onClick={() => handleSelectConv(conv.conversationId)}
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    borderLeft: `2px solid ${active ? '#534AB7' : 'transparent'}`,
                    background: active ? 'var(--color-background-primary)' : 'transparent',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    transition: 'background .12s',
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>
                    {formatTime(conv.lastAskedAt)}
                  </div>
                  <div style={{
                    fontSize: '11.5px',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: active ? 500 : 400,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: '1.4',
                  }}>
                    {conv.firstQuestion}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    {conv.questionCount} question{conv.questionCount !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 14px',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: '#EEEDFE', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: '#3C3489',
          }}>
            {userInitials}
          </div>
          <span style={{
            fontSize: '11px', color: 'var(--color-text-secondary)',
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user?.email}
          </span>
          <button
            onClick={logout}
            style={{
              fontSize: '11px', color: 'var(--color-text-tertiary)',
              padding: '2px 7px', border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: '6px', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          padding: '11px 20px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: 'var(--color-background-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button
              onClick={() => navigate('/app')}
              style={{
                fontSize: '11px', color: 'var(--color-text-secondary)',
                padding: '4px 10px', border: '0.5px solid var(--color-border-secondary)',
                borderRadius: '6px', background: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
              }}
            >
              ← Dashboard
            </button>
            {messages.length > 0 && (
              <span style={{
                fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {convTitle}
              </span>
            )}
          </div>

          <button
            onClick={handleNewConv}
            style={{
              fontSize: '11px', color: '#3C3489',
              padding: '4px 12px', border: '0.5px solid #AFA9EC',
              borderRadius: '6px', background: '#EEEDFE', cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            + New conversation
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 8px' }}>
          {messages.length === 0 ? (
            <EmptyState
              hasConversations={conversations.length > 0}
              intent={intent}
              onPickPrompt={(prompt) => handleSend(prompt)}
            />
          ) : (
            <>
              {/* History divider at top if first message is from history */}
              {messages[0]?.isHistory && (
                <Divider label="Conversation history" />
              )}

              {messages.map((m, i) => {
                const prevIsHistory = i > 0 && messages[i - 1].isHistory
                const currIsNew     = !m.isHistory
                const showDivider   = prevIsHistory && currIsNew

                return (
                  <div key={m.id}>
                    {showDivider && <Divider label="Continuing now" strong />}
                    <MessageRow
                      role={m.role}
                      content={m.content}
                      citations={m.citations}
                      latencyMs={m.latencyMs}
                      isHistory={m.isHistory}
                      isStreaming={m.isStreaming}
                      userInitials={userInitials}
                    />
                  </div>
                )
              })}
            </>
          )}

          {error && (
            <div style={{
              fontSize: '12px', color: 'var(--color-text-danger)',
              padding: '8px 12px', background: 'var(--color-background-danger)',
              borderRadius: '8px', marginTop: '8px',
            }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 20px 14px',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          flexShrink: 0,
          background: 'var(--color-background-primary)',
        }}>
          <div style={{
            display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px',
          }}>
            {INTENT_MODES.map(mode => {
              const active = intent === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setIntent(mode.id)}
                  title={mode.description}
                  style={{
                    fontSize: '11px',
                    fontWeight: active ? 600 : 400,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    border: `1px solid ${active ? mode.border : 'var(--color-border-secondary)'}`,
                    background: active ? mode.bg : 'transparent',
                    color: active ? mode.color : 'var(--color-text-secondary)',
                  }}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            background: 'var(--color-background-secondary)',
            border: `0.5px solid ${draft ? '#534AB7' : 'var(--color-border-secondary)'}`,
            borderRadius: '12px',
            padding: '8px 8px 8px 14px',
            transition: 'border-color .15s',
          }}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? 'Generating answer...'
                  : intent === 'DEBUG'
                    ? 'Describe the bug, error, or failure…'
                    : activeConvId
                      ? 'Ask a follow-up question...'
                      : 'Ask anything about this codebase...'
              }
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: '13px', color: 'var(--color-text-primary)',
                resize: 'none', fontFamily: 'inherit', lineHeight: '1.55',
                minHeight: '22px', maxHeight: '120px', overflow: 'auto',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!draft.trim() || isStreaming}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: draft.trim() && !isStreaming ? '#534AB7' : 'var(--color-background-secondary)',
                border: `0.5px solid ${draft.trim() && !isStreaming ? '#534AB7' : 'var(--color-border-secondary)'}`,
                cursor: draft.trim() && !isStreaming ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                stroke={draft.trim() && !isStreaming ? '#fff' : 'var(--color-text-tertiary)'}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 7h10M8 3l4 4-4 4"/>
              </svg>
            </button>
          </div>
          <div style={{
            fontSize: '10px', color: 'var(--color-text-tertiary)',
            marginTop: '5px', paddingLeft: '2px',
            display: 'flex', justifyContent: 'space-between', gap: '8px',
          }}>
            <span>Enter to send · Shift+Enter for new line</span>
            <span style={{ color: INTENT_MODES.find(m => m.id === intent)?.color }}>
              {intent === 'DEBUG' ? 'Debug prompt active' : `${intent.charAt(0) + intent.slice(1).toLowerCase()} mode`}
            </span>
          </div>
        </div>
      </main>

      <CodeViewer />

      <style>{`
        @keyframes bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}