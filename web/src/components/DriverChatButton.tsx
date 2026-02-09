import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useSocket } from '../ws/useSocket';
import ChatWindow from '../pages/chat/ChatWindow';
import { Chat, ChatMessage } from '../types/chat';
import { useAuthStore } from '../store/auth';

interface DriverChatButtonProps {
  userId: string; // Driver's user ID
}

export default function DriverChatButton({ userId }: DriverChatButtonProps) {
  const { t } = useTranslation();
  const { socket } = useSocket();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  // Fetch unread count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await api.get<{ count: number }>(`/chat/${userId}/unread-count`);
        if (data) setUnreadCount(data.count);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Messages effect
  useEffect(() => {
    if (!isOpen) return;

    const fetchChat = async () => {
      setLoading(true);
      try {
        const c = await api.get<Chat>(`/chat/${userId}`);
        if (c) {
          setChat(c);
          const msgs = await api.get<ChatMessage[]>(`/chat/${userId}/messages`);
          if (msgs) setMessages(msgs.reverse());

          setUnreadCount(0); // Reset local unread
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchChat();
  }, [isOpen, userId]);

  // WebSocket updates
  useEffect(() => {
    if (!socket) return;

    socket.on('chat.message', (payload: any) => {
      if (payload.driverId === userId) {
        if (isOpen) {
          setMessages((prev) => [...prev, payload.message]);
        } else {
          setUnreadCount((prev) => prev + 1);
        }
      }
    });

    return () => {
      socket.off('chat.message');
    };
  }, [socket, userId, isOpen]);

  const handleSendMessage = async (text: string, file?: File) => {
    try {
      let fileUrl: string | undefined;
      let fileType: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = (await (api as any).upload('/upload', formData)) as {
          url: string;
          mimetype: string;
        };
        if (uploadRes) {
          fileUrl = uploadRes.url;
          fileType = uploadRes.mimetype;
        }
      }

      await api.post(`/chat/${userId}/messages`, {
        message: text,
        fileUrl,
        fileType,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--rd-accent-neon, #38bdf8)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
          zIndex: 9999,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(56, 189, 248, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.4)';
        }}
        aria-label={t('chat.title')}
      >
        💬
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              background: '#ef4444',
              color: '#fff',
              fontSize: '12px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              border: '2px solid #fff',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '170px',
            right: '20px',
            width: '350px',
            height: '500px',
            maxWidth: 'calc(100vw - 40px)',
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {chat ? (
            <ChatWindow
              chat={chat}
              messages={messages}
              currentUserId={currentUser?.id || ''}
              onSendMessage={handleSendMessage}
              onCloseChat={() => setIsOpen(false)}
              loading={loading}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: '0.875rem',
                  }}
                >
                  {t('chat.exit')}
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'rgba(255,255,255,0.8)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>{t('chat.loadingChat')}</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', textAlign: 'left', fontSize: '0.875rem' }}>
                  <li>{t('chat.startConversation')}</li>
                  <li>{t('chat.sendImageFiles')}</li>
                  <li>{t('chat.takePicture')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
