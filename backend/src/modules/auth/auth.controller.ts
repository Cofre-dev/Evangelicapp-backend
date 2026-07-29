import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Usuario } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AuthService, LoginResponse } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { fotoPerfilMulterOptions } from './foto-perfil-upload.config';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

/**
 * accessToken/refreshToken van solo en cookies httpOnly. csrfToken SÍ va en el
 * body: en el deploy real (frontend y backend en dominios distintos) una
 * cookie no-httpOnly seteada por el backend no es legible vía document.cookie
 * desde el origen del frontend (restricción de scoping por dominio, no de
 * httpOnly/sameSite) — el body es el único canal por el que el frontend puede
 * obtener el valor para reflejarlo en el header X-CSRF-Token.
 */
type LoginResponseBody = Omit<LoginResponse, 'accessToken' | 'refreshToken'>;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Login único para todos los roles, incluido el primer ingreso del pastor
   * con la contraseña temporal generada por el SuperAdmin. El body se valida
   * con LoginDto; las credenciales en sí las verifica LocalStrategy. accessToken/
   * refreshToken nunca viajan en el body: van en cookies httpOnly (ver ./cookies.ts).
   * csrfToken sí viaja en el body (ver comentario de LoginResponseBody más arriba).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(
    @Body() _dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseBody> {
    const { accessToken, refreshToken, ...body } = await this.authService.login(req.user as Usuario);

    setAuthCookies(res, this.config, { accessToken, refreshToken, csrfToken: body.csrfToken });

    return body;
  }

  /** El refresh token se lee de su cookie (JwtRefreshStrategy), nunca del body. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; csrfToken: string }> {
    const { accessToken, refreshToken, csrfToken } = await this.authService.refreshTokens(
      req.user as JwtRefreshPayload,
    );

    setAuthCookies(res, this.config, { accessToken, refreshToken, csrfToken });

    return { ok: true, csrfToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(user.sub);
    clearAuthCookies(res, this.config);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /** Autoedición del perfil (cualquier rol). Solo datos personales: nombre, apellido, teléfono. */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMyProfileDto) {
    return this.authService.updateMe(user.sub, dto);
  }

  /** Sube/reemplaza la foto de perfil del usuario autenticado. */
  @Patch('me/foto')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('foto', fotoPerfilMulterOptions))
  async updateMiFoto(@CurrentUser() user: JwtPayload, @UploadedFile() foto?: Express.Multer.File) {
    if (!foto) {
      throw new BadRequestException('Debe adjuntar un archivo de foto');
    }
    return this.authService.updateMiFoto(user.sub, foto);
  }

  /**
   * Usado tanto para el cambio forzado tras el primer login (mustChangePassword)
   * como para un cambio voluntario posterior. Revoca las demás sesiones activas.
   */
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.changePassword(user.sub, dto);
  }
}
