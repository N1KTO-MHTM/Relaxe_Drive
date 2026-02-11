import { useTranslation } from '../../i18n';
import { Chat } from '../../types/chat';

export type ChatFilter = 'OPEN' | 'WAITING' | 'CLOSED';

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  currentUserId?: string;
  currentUserRole?: string;
}

export default function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  filter,
  onFilterChange,
  currentUserId,
  currentUserRole,
}: ChatListProps) {
  const { t } = useTranslation();
  const isDriver = currentUserRole === 'DRIVER';

  const getStatusColor = (status: string, unread: number) => {
    if (status === 'WAITING' || unread > 0) return '#eab308';
    if (status === 'CLOSED') return '#9ca3af';
    return '#22c55e';
  };

  const filteredChats = isDriver
    ? chats
    : chats.filter((chat) => chat.status === filter);

  return (
    <div
      className="chat-list-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRight: '1px solid var(--rd-border, rgba(255,255,255,0.1))',
        background: 'var(--rd-bg-panel, rgba(0,0,0,0.2))',
      }}
    >
      {!isDriver && (
        <div
          className="chat-filters"
          style={{
            padding: '1rem',
            borderBottom: '1px solid var(--rd-border)',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {(['OPEN', 'WAITING', 'CLOSED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              type="button"
              className="rd-btn rd-btn--small"
              style={{
                background: filter === f ? 'var(--rd-accent-neon, #38bdf8)' : 'rgba(255,255,255,0.08)',
                color: filter === f ? '#0f172a' : '#e2e8f0',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {f === 'OPEN' ? t('chat.filterChat') : f === 'WAITING' ? t('chat.filterWaiting') : t('chat.filterClosed')}
            </button>
          ))}
        </div>
      )}

      <div className="chat-items" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectChat(chat);
              }
            }}
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--rd-border-subtle, rgba(255,255,255,0.06))',
              cursor: 'pointer',
              background: selectedChatId === chat.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              transition: 'background 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: getStatusColor(chat.status, chat.unreadCount),
                  }}
                />
                <span style={{ fontWeight: 600, color: 'var(--rd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isDriver && chat.driverId === currentUserId
                    ? t('chat.supportWith')
                    : (chat.driver?.nickname || chat.driver?.phone || chat.driverId || t('chat.title'))}
                </span>
                {chat.unreadCount > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '9999px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {chat.unreadCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--rd-text-muted)', flexShrink: 0 }}>
                {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--rd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {chat.lastMessage || (isDriver ? t('chat.startConversation') : '')}
            </div>
          </div>
        ))}

        {filteredChats.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--rd-text-muted)' }}>
            {isDriver ? t('chat.startConversation') : t('chat.noChatsFound')}
          </div>
        )}
      </div>
    </div>
  );
}
