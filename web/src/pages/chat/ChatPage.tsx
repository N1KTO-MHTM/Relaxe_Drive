import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useSocket } from '../../ws/useSocket';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { Chat, ChatMessage } from '../../types/chat';
import { useAuthStore } from '../../store/auth';

export default function ChatPage() {
    const { user } = useAuthStore();
    const { socket } = useSocket();

    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'WAITING' | 'CLOSED'>('ALL');
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Fetch chats
    useEffect(() => {
        const fetchChats = async () => {
            try {
                const data = await api.get<Chat[]>('/chat?status=' + (filter === 'ALL' ? '' : filter));
                if (data) setChats(data);
            } catch (err) {
                console.error('Failed to fetch chats', err);
            }
        };
        fetchChats();
        // Poll for updates every 30s
        const interval = setInterval(fetchChats, 30000);
        return () => clearInterval(interval);
    }, [filter]);

    // Fetch messages when chat selected
    useEffect(() => {
        if (!selectedChat) return;

        const fetchMessages = async () => {
            setLoadingMessages(true);
            try {
                const msgs = await api.get<ChatMessage[]>(`/chat/${selectedChat.driverId}/messages`);
                if (msgs) {
                    setMessages(msgs.reverse());
                    // Mark as read
                    await api.patch(`/chat/${selectedChat.driverId}/read`, {});
                }
            } catch (err) {
                console.error('Failed to fetch messages', err);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedChat]);

    // WebSocket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('chat.message', (payload: any) => {
            // Update chat list
            setChats(prev => {
                const exists = prev.find(c => c.id === payload.chatId);
                if (exists) {
                    return prev.map(c => c.id === payload.chatId ? {
                        ...c,
                        lastMessage: payload.message.message,
                        lastMessageAt: payload.message.createdAt,
                        unreadCount: c.id !== selectedChat?.id ? c.unreadCount + 1 : c.unreadCount
                    } : c).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
                }
                return prev;
            });

            // Update current message list if chat is open
            if (selectedChat && payload.chatId === selectedChat.id) {
                setMessages(prev => [...prev, payload.message]);
                if (payload.driverId === selectedChat.driverId) {
                    api.patch(`/chat/${payload.driverId}/read`, {}).catch(console.error);
                }
            }
        });

        return () => {
            socket.off('chat.message');
        };
    }, [socket, selectedChat]);

    const handleSendMessage = async (text: string) => {
        if (!selectedChat) return;

        try {
            const msg = await api.post<ChatMessage>(`/chat/${selectedChat.driverId}/messages`, { message: text });
            // Message will be added via WebSocket event usually, but we can optimistically add it
            if (msg) {
                // setMessages(prev => [...prev, msg]); // Let WS handle it to avoid duplicate
            }
        } catch (err) {
            console.error('Failed to send message', err);
        }
    };

    return (
        <div className="chat-page" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <div style={{ width: 350, minWidth: 350, height: '100%' }}>
                <ChatList
                    chats={chats}
                    selectedChatId={selectedChat?.id}
                    onSelectChat={setSelectedChat}
                    filter={filter}
                    onFilterChange={setFilter}
                />
            </div>
            <div style={{ flex: 1, height: '100%' }}>
                {selectedChat ? (
                    <ChatWindow
                        chat={selectedChat}
                        messages={messages}
                        currentUserId={user?.id || ''}
                        onSendMessage={handleSendMessage}
                        loading={loadingMessages}
                    />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f9fafb', color: '#9ca3af' }}>
                        Select a chat to start messaging
                    </div>
                )}
            </div>
        </div>
    );
}
