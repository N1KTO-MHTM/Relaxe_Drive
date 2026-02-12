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
  const isDriverView = chat.driverId === currentUserId;
  const headerTitle = isDriverView ? t('chat.supportWith') : (chat.driver?.nickname || chat.driver?.phone || t('chat.title'));

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="chat-window chat-window--modern">
      {/* Header: gradient blue, "Chat with [Name]", "We're online" */}
      <div className="chat-window__header">
        <div className="chat-window__header-inner">
          <div className="chat-window__header-info">
            <h3 className="chat-window__header-title">{headerTitle}</h3>
            <span className="chat-window__header-status">{t('chat.weAreOnline')}</span>
          </div>
          <button
            type="button"
            onClick={onCloseChat}
            className="chat-window__header-close"
            aria-label={t('chat.closeChat')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages: light area, bubbles */}
      <div className="chat-window__messages">
        {loading ? (
          <div className="chat-window__loading">Loading...</div>
        ) : (
          <>
            {messages.length === 0 && isDriverView && (
              <div className="chat-window__hint">{t('chat.typeToStart')}</div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
              <div
                key={msg.id}
                className={`chat-window__bubble ${isMe ? 'chat-window__bubble--me' : 'chat-window__bubble--them'}`}
              >
                <div className="chat-window__bubble-body">
                  {msg.fileUrl && (
                    <div className="chat-window__bubble-file">
                      {msg.fileType?.startsWith('image/') ? (
                        <img
                          src={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${msg.fileUrl}`}
                          alt="attachment"
                          className="chat-window__bubble-img"
                        />
                      ) : (
                        <a
                          href={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${msg.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chat-window__bubble-link"
                        >
                          📎 Attachment
                        </a>
                      )}
                    </div>
                  )}
                  {msg.message}
                </div>
                <div className="chat-window__bubble-meta">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMe && <span>{msg.read ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            );
          })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!inputText.trim() && !selectedFile) return;
          onSendMessage(inputText, selectedFile ?? undefined);
          setInputText('');
          setSelectedFile(null);
        }}
        className="chat-window__form"
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
            placeholder={t('chat.enterYourMessage')}
          />
          <button
            type="submit"
            className="chat-window__send-btn"
            disabled={!inputText.trim() && !selectedFile}
            aria-label="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
