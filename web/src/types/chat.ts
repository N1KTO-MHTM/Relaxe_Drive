export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: 'DRIVER' | 'DISPATCHER';
  message: string;
  read: boolean;
  fileUrl?: string;
  fileType?: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  driverId: string;
  status: 'OPEN' | 'WAITING' | 'CLOSED';
  lastMessageAt: string;
  lastMessage?: string;
  unreadCount: number;
  messages?: ChatMessage[];
  driver?: {
    id: string;
    nickname: string;
    phone?: string;
    driverId?: string;
  };
}
