import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, ChatMessage } from '../../types/chat';

interface ChatWindowProps {
    chat: Chat;
    messages: ChatMessage[];
    currentUserId: string;
    onSendMessage: (message: string) => void;
    onCloseChat?: () => void;
    loading?: boolean;
}

export default function ChatWindow({ chat, messages, currentUserId, onSendMessage, onCloseChat, loading }: ChatWindowProps) {
    const { t } = useTranslation();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText);
        setInputText('');
    };

    return (
        <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f9fafb' }}>
            {/* Header */}
            <div style={{
                padding: '1rem',
                background: '#fff',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                        {chat.driver?.nickname || chat.driver?.phone || 'Driver'}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {chat.driver?.driverId ? `ID: ${chat.driver.driverId}` : ''}
                    </span>
                </div>
                {onCloseChat && (
                    <button
                        onClick={onCloseChat}
                        style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#374151'
                        }}
                    >
                        {t('common.close')}
                    </button>
                )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>Loading...</div>
                ) : messages.map((msg) => {
                    const isMe = msg.senderId === currentUserId;
                    return (
                        <div
                            key={msg.id}
                            style={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '70%',
                                background: isMe ? '#2563eb' : '#fff',
                                color: isMe ? '#fff' : '#1f2937',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                borderBottomRightRadius: isMe ? '2px' : '12px',
                                borderBottomLeftRadius: isMe ? '12px' : '2px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                position: 'relative'
                            }}
                        >
                            <div style={{ marginBottom: '0.25rem' }}>{msg.message}</div>
                            <div style={{
                                fontSize: '0.7rem',
                                color: isMe ? 'rgba(255,255,255,0.8)' : '#9ca3af',
                                textAlign: 'right',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '4px'
                            }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMe && (
                                    <span>{msg.read ? '✓✓' : '✓'}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                style={{
                    padding: '1rem',
                    background: '#fff',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.5rem'
                }}
            >
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '9999px',
                        outline: 'none',
                        fontSize: '0.95rem'
                    }}
                />
                <button
                    type="submit"
                    disabled={!inputText.trim()}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        cursor: inputText.trim() ? 'pointer' : 'default',
                        opacity: inputText.trim() ? 1 : 0.5
                    }}
                >
                    Send
                </button>
            </form>
        </div>
    );
}
