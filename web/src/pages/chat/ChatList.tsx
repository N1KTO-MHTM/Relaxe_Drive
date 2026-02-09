import { useTranslation } from 'react-i18next';
import { Chat } from '../../types/chat';

interface ChatListProps {
    chats: Chat[];
    selectedChatId?: string;
    onSelectChat: (chat: Chat) => void;
    filter: 'ALL' | 'ONLINE' | 'WAITING' | 'CLOSED';
    onFilterChange: (filter: 'ALL' | 'ONLINE' | 'WAITING' | 'CLOSED') => void;
    currentUserId?: string;
    currentUserRole?: string;
}

export default function ChatList({ chats, selectedChatId, onSelectChat, filter, onFilterChange, currentUserId, currentUserRole }: ChatListProps) {
    const { t } = useTranslation();

    const getStatusColor = (status: string, unread: number) => {
        if (status === 'WAITING' || unread > 0) return '#eab308'; // Yellow
        if (status === 'CLOSED') return '#9ca3af'; // Gray
        return '#22c55e'; // Green
    };

    const filteredChats = chats.filter(chat => {
        if (filter === 'ALL') return chat.status !== 'CLOSED';
        return chat.status === filter;
    });

    return (
        <div className="chat-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #e5e7eb', background: '#fff' }}>
            <div className="chat-filters" style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                {(['ALL', 'ONLINE', 'WAITING', 'CLOSED'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => onFilterChange(f)}
                        style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            border: 'none',
                            background: filter === f ? '#2563eb' : '#f3f4f6',
                            color: filter === f ? '#fff' : '#4b5563',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="chat-items" style={{ flex: 1, overflowY: 'auto' }}>
                {filteredChats.map((chat) => (
                    <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat)}
                        style={{
                            padding: '1rem',
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            background: selectedChatId === chat.id ? '#eff6ff' : '#fff',
                            transition: 'background 0.2s',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: getStatusColor(chat.status, chat.unreadCount),
                                    }}
                                />
                                <span style={{ fontWeight: 600, color: '#111827' }}>
                                    {currentUserRole === 'DRIVER' && chat.driverId === currentUserId
                                        ? t('chat.title')
                                        : (chat.driver?.nickname || chat.driver?.phone || 'Unknown Driver')}
                                </span>
                                {chat.unreadCount > 0 && (
                                    <span style={{
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.7rem',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '9999px',
                                        fontWeight: 700
                                    }}>
                                        {chat.unreadCount}
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {chat.lastMessage || 'No messages'}
                        </div>
                    </div>
                ))}

                {filteredChats.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                        No chats found
                    </div>
                )}
            </div>
        </div>
    );
}
