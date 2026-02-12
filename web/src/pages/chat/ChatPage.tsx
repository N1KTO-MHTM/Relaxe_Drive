import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { api } from '../../api/client';
import { useSocket } from '../../ws/useSocket';
import ChatList, { type ChatFilter } from './ChatList';
import ChatWindow from './ChatWindow';
import { Chat, ChatMessage } from '../../types/chat';
import './Chat.css';
import { useAuthStore } from '../../store/auth';

const DEFAULT_FILTER: ChatFilter = 'OPEN';

export default function ChatPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<ChatFilter>(DEFAULT_FILTER);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const isDriver = user?.role === 'DRIVER';

  const driverIdForRequest = selectedChat?.driverId ?? (isDriver ? user?.id : undefined);

  // Fetch chats: staff by filter (OPEN/WAITING/CLOSED), driver gets own
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const statusParam = isDriver ? '' : filter;
        const data = await api.get<Chat[]>(`/chat${statusParam ? `?status=${statusParam}` : ''}`);
        if (data) setChats(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch chats', err);
      }
    };
    fetchChats();
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [filter, isDriver]);

  // Fetch messages when a chat is selected (or driver "start conversation")
  useEffect(() => {
    if (!driverIdForRequest) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      setMessages([]);
      try {
        const raw = await api.get<ChatMessage[] | { messages?: ChatMessage[]; data?: ChatMessage[] }>(`/chat/${driverIdForRequest}/messages`);
        let list: ChatMessage[] = [];
        if (Array.isArray(raw)) {
          list = raw;
        } else if (raw && typeof raw === 'object') {
          const arr = (raw as { messages?: ChatMessage[] }).messages ?? (raw as { data?: ChatMessage[] }).data;
          list = Array.isArray(arr) ? arr : [];
        }
        setMessages(list.slice().reverse());
        await api.patch(`/chat/${driverIdForRequest}/read`, {}).catch(() => {});
      } catch (err) {
        console.error('Failed to fetch messages', err);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [driverIdForRequest]);

  // WebSocket: new message
  useEffect(() => {
    if (!socket) return;

    socket.on('chat.message', (payload: { chatId: string; driverId: string; message: ChatMessage }) => {
      setChats((prev) => {
        const exists = prev.find((c) => c.id === payload.chatId);
        if (exists) {
          return prev
            .map((c) =>
              c.id === payload.chatId
                ? {
                    ...c,
                    lastMessage: payload.message.message,
                    lastMessageAt: payload.message.createdAt,
                    unreadCount: selectedChat?.id !== payload.chatId ? c.unreadCount + 1 : c.unreadCount,
                  }
                : c,
            )
            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        }
        return prev;
      });

      if (selectedChat && payload.chatId === selectedChat.id) {
        setMessages((prev) => [...prev, payload.message]);
        if (payload.driverId === selectedChat.driverId) {
          api.patch(`/chat/${payload.driverId}/read`, {}).catch(() => {});
        }
      }
    });

    return () => {
      socket.off('chat.message');
    };
  }, [socket, selectedChat?.id, selectedChat?.driverId]);

  const handleSendMessage = async (text: string, file?: File) => {
    if (!driverIdForRequest) return;

    let fileUrl: string | undefined;
    let fileType: string | undefined;
    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await api.upload<{ url: string; mimetype: string }>('/upload', formData);
        if (uploaded?.url) {
          fileUrl = uploaded.url;
          fileType = uploaded.mimetype;
        }
      } catch (err) {
        console.error('Upload failed', err);
        return;
      }
    }

    try {
      await api.post<ChatMessage>(`/chat/${driverIdForRequest}/messages`, {
        message: text || (fileUrl ? '[File]' : ''),
        fileUrl,
        fileType,
      });
      if (!selectedChat && isDriver && user) {
        setSelectedChat({
          id: '',
          driverId: user.id,
          status: 'OPEN',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
          driver: { id: user.id, nickname: user.nickname ?? '', phone: user.phone },
        });
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const handleCloseChat = () => {
    if (selectedChat && !isDriver) {
      api.patch(`/chat/${selectedChat.driverId}/close`, {}).catch(() => {});
      setChats((prev) =>
        prev.map((c) => (c.id === selectedChat.id ? { ...c, status: 'CLOSED' as const } : c)),
      );
    }
    setSelectedChat(null);
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
  };

  // Driver with no chats yet: use synthetic chat so they can send first message (backend creates chat on first message)
  const effectiveChat =
    selectedChat ??
    (isDriver && user
      ? {
          id: '',
          driverId: user.id,
          status: 'OPEN' as const,
          lastMessageAt: '',
          unreadCount: 0,
          driver: { id: user.id, nickname: user.nickname ?? '', phone: user.phone },
        }
      : null);

  return (
    <div className={`chat-page ${effectiveChat ? 'chat-page--conversation-open' : ''}`}>
      <div className="chat-page__list" style={{ width: 320, minWidth: 280, maxWidth: '40%', height: '100%' }}>
        <ChatList
          chats={chats}
          selectedChatId={selectedChat?.id}
          onSelectChat={handleSelectChat}
          filter={filter}
          onFilterChange={setFilter}
          currentUserId={user?.id}
          currentUserRole={user?.role}
        />
      </div>
      <div className="chat-page__window" style={{ flex: 1, height: '100%', minWidth: 0 }}>
        {effectiveChat ? (
          <ChatWindow
            chat={effectiveChat}
            messages={messages}
            currentUserId={user?.id || ''}
            onSendMessage={handleSendMessage}
            onCloseChat={handleCloseChat}
            loading={loadingMessages}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: 'var(--rd-bg-panel)',
              color: 'var(--rd-text-muted)',
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0 }}>{t('chat.selectToStart')}</p>
            {isDriver && <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>{t('chat.typeToStart')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
