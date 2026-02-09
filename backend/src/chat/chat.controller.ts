import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Get all chats. Dispatchers/Admins see all; drivers see only their own (with same filters: ALL, ONLINE, WAITING, CLOSED).
   */
  @Get()
  @Roles('DRIVER', 'DISPATCHER', 'ADMIN')
  async getChats(@Request() req: any, @Query('status') status?: string) {
    return this.chatService.getChats(status, req.user?.userId, req.user?.role);
  }

  /**
   * Get chat for a specific driver
   */
  @Get(':driverId')
  @Roles('DRIVER', 'DISPATCHER', 'ADMIN')
  async getChat(@Request() req: any, @Param('driverId') driverId: string) {
    // Drivers can only access their own chat
    if (req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      throw new Error('Unauthorized');
    }

    return this.chatService.getOrCreateChat(driverId);
  }

  /**
   * Get messages for a chat
   */
  @Get(':driverId/messages')
  @Roles('DRIVER', 'DISPATCHER', 'ADMIN')
  async getMessages(
    @Request() req: any,
    @Param('driverId') driverId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    // Drivers can only access their own messages
    if (req.user.role === 'DRIVER' && req.user.userId !== driverId) {
      throw new Error('Unauthorized');
    }

    return this.chatService.getMessages(driverId, limit ? parseInt(limit, 10) : 50, before);
  }

  /**
   * Send a message
   */
  @Post(':driverId/messages')
  @Roles('DRIVER', 'DISPATCHER', 'ADMIN')
  async sendMessage(
    @Request() req: any,
    @Param('driverId') driverId: string,
    @Body() body: { message: string; fileUrl?: string; fileType?: string },
  ) {
    const senderRole = req.user.role === 'DRIVER' ? 'DRIVER' : 'DISPATCHER';

    return this.chatService.sendMessage({
      driverId,
      senderId: req.user.userId,
      senderRole,
      message: body.message,
      fileUrl: body.fileUrl,
      fileType: body.fileType,
    });
  }

  /**
   * Mark messages as read
   */
  @Patch(':driverId/read')
  @Roles('DRIVER', 'DISPATCHER', 'ADMIN')
  async markAsRead(@Request() req: any, @Param('driverId') driverId: string) {
    return this.chatService.markAsRead(driverId, req.user.userId);
  }

  /**
   * Close a chat
   */
  @Patch(':driverId/close')
  @Roles('DISPATCHER', 'ADMIN')
  async closeChat(@Param('driverId') driverId: string) {
    return this.chatService.closeChat(driverId);
  }

  /**
   * Get unread count
   */
  @Get(':driverId/unread-count')
  @Roles('DRIVER')
  async getUnreadCount(@Request() req: any, @Param('driverId') driverId: string) {
    if (req.user.userId !== driverId) {
      throw new Error('Unauthorized');
    }

    return { count: await this.chatService.getUnreadCount(driverId) };
  }
}
