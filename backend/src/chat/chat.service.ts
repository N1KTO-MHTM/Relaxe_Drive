import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: RelaxDriveWsGateway,
  ) {}

  /**
   * Get all chats with optional status filter. For DRIVER, only return their own chat.
   */
  async getChats(status?: string, userId?: string, role?: string) {
    const where: any = {};
    if (role === 'DRIVER' && userId) {
      where.driverId = userId;
    }
    // Map frontend "ONLINE" to backend "OPEN"
    const statusFilter = status === 'ONLINE' ? 'OPEN' : status;
    if (statusFilter && ['OPEN', 'WAITING', 'CLOSED'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    return this.prisma.chat.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get or create chat for a driver
   */
  async getOrCreateChat(driverId: string) {
    let chat = await this.prisma.chat.findUnique({
      where: { driverId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: { driverId },
        include: {
          messages: true,
        },
      });
    }

    return chat;
  }

  /**
   * Get chat messages with pagination
   */
  async getMessages(driverId: string, limit = 50, before?: string) {
    const where: any = {
      chat: { driverId },
    };

    if (before) {
      where.createdAt = { lt: new Date(before) };
    }

    return this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Send a message
   */
  async sendMessage(data: {
    driverId: string;
    senderId: string;
    senderRole: string;
    message: string;
    fileUrl?: string; // Optional file
    fileType?: string; // Optional type
  }) {
    // Get or create chat
    const chat = await this.getOrCreateChat(data.driverId);

    // Create message
    const chatMessage = await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: data.senderId,
        senderRole: data.senderRole,
        message: data.message,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
      },
    });

    // Update chat
    const newStatus = data.senderRole === 'DRIVER' ? 'WAITING' : 'OPEN';
    const newUnreadCount = data.senderRole === 'DRIVER' ? chat.unreadCount + 1 : 0;

    await this.prisma.chat.update({
      where: { id: chat.id },
      data: {
        lastMessageAt: new Date(),
        lastMessage: data.fileUrl ? '[File]' : data.message,
        status: newStatus,
        unreadCount: newUnreadCount,
      },
    });

    // Broadcast via WebSocket
    this.wsGateway.broadcastChatMessage({
      driverId: data.driverId,
      chatId: chat.id,
      message: {
        id: chatMessage.id,
        senderId: chatMessage.senderId,
        senderRole: chatMessage.senderRole,
        message: chatMessage.message,
        fileUrl: chatMessage.fileUrl,
        fileType: chatMessage.fileType,
        read: chatMessage.read,
        createdAt: chatMessage.createdAt.toISOString(),
      },
    });

    return chatMessage;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(driverId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { driverId },
    });

    if (!chat) return;

    // Mark all unread messages as read
    await this.prisma.chatMessage.updateMany({
      where: {
        chatId: chat.id,
        read: false,
        senderId: { not: userId },
      },
      data: { read: true },
    });

    // Reset unread count
    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { unreadCount: 0 },
    });

    // Broadcast read status
    this.wsGateway.broadcastChatRead({
      driverId,
      chatId: chat.id,
      userId,
    });
  }

  /**
   * Close a chat
   */
  async closeChat(driverId: string) {
    return this.prisma.chat.update({
      where: { driverId },
      data: { status: 'CLOSED' },
    });
  }

  /**
   * Get unread count for a driver
   */
  async getUnreadCount(driverId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { driverId },
      select: { unreadCount: true },
    });

    return chat?.unreadCount ?? 0;
  }
}
