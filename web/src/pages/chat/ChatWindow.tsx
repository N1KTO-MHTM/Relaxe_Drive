import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { Chat, ChatMessage } from '../../types/chat';

interface ChatWindowProps {
  chat: Chat;
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string, file?: File) => void;
  onCloseChat: () => void;
  loading?: boolean;
}

export default function ChatWindow({
  chat,
  messages,
  currentUserId,
  onSendMessage,
  onCloseChat,
  loading,
}: ChatWindowProps) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      className="chat-window"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'transparent',
      }}
    >
      {/* Header: title can shrink so Close button is never cut off on mobile */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chat.driver?.nickname || chat.driver?.phone || t('chat.title')}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            {chat.driver?.driverId ? `ID: ${chat.driver.driverId}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseChat}
          aria-label={t('chat.closeChat')}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '0.875rem',
            flexShrink: 0,
          }}
        >
          {t('chat.closeChat')}
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>Loading...</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  background: isMe ? 'var(--rd-accent-neon, #38bdf8)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  borderBottomRightRadius: isMe ? '2px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  position: 'relative',
                }}
              >
                <div style={{ marginBottom: '0.25rem' }}>
                  {msg.fileUrl && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      {msg.fileType?.startsWith('image/') ? (
                        <img
                          src={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${msg.fileUrl}`}
                          alt="attachment"
                          style={{
                            maxWidth: '100%',
                            borderRadius: '8px',
                            maxHeight: '200px',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <a
                          href={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${msg.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#fff',
                            textDecoration: 'underline',
                            fontSize: '0.9rem',
                          }}
                        >
                          📎 Attachment
                        </a>
                      )}
                    </div>
                  )}
                  {msg.message}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: isMe ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                  }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {isMe && <span>{msg.read ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input: row wraps on mobile so nothing is cut off */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!inputText.trim() && !selectedFile) return;
          onSendMessage(inputText, selectedFile ?? undefined);
          setInputText('');
          setSelectedFile(null);
        }}
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.8)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {selectedFile && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#9ca3af',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.25rem 0.5rem',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {selectedFile.name}</span>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="chat-window__input-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
              }
            }}
          />
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title={t('chat.sendImageFiles')}
            aria-label={t('chat.sendImageFiles')}
          >
            📎
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            style={{
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title={t('chat.takePicture')}
            aria-label={t('chat.takePicture')}
          >
            📷
          </button>
          <input
            type="text"
            className="chat-window__text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('chat.startConversation')}
            style={{
              flex: '1 1 120px',
              minWidth: 0,
              padding: '0.75rem 1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fff',
              borderRadius: '9999px',
              outline: 'none',
              fontSize: '0.95rem',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            className="chat-window__send-btn"
            disabled={!inputText.trim() && !selectedFile}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'var(--rd-accent-neon, #38bdf8)',
              color: '#fff',
              border: 'none',
              borderRadius: '9999px',
              fontWeight: 600,
              cursor: inputText.trim() || selectedFile ? 'pointer' : 'default',
              opacity: inputText.trim() || selectedFile ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
