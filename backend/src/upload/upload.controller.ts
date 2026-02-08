import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }), // 10MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: any,
  ) {
    // Return the path or URL where the file can be accessed
    // Assuming we serve 'uploads' directory statically at /uploads
    return {
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
