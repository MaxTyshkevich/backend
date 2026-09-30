import {
  ConflictException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 64;

const FAKE_SALT = '00'.repeat(PASSWORD_SALT_BYTES);
const FAKE_PASSWORD_HASH = '00'.repeat(PASSWORD_HASH_BYTES);

const SCRYPT_OPTIONS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

const publicFields = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicFields;
}>;

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, PASSWORD_HASH_BYTES, SCRYPT_OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const sessionCookie = 'microfronts_session';
export const sessionLifetime = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly database: PrismaService) {}

  async limit(ip: string, email: string) {
    await this.database.authAttempt.deleteMany({
      where: { resetsAt: { lte: new Date() } },
    });
    const buckets = [
      [`ip:${ip}`, 40],
      [`email:${email}`, 10],
    ] as const;
    await this.database.withLocks(
      buckets.map(([bucket]) => `auth:${bucket}`),
      async (tx) => {
        const now = new Date();
        for (const [bucket, maximum] of buckets) {
          const row = await tx.authAttempt.findUnique({ where: { bucket } });
          const active = row && row.resetsAt > now;
          if (active && row.attempts >= maximum) {
            throw new HttpException(
              'Слишком много попыток. Повторите через 15 минут.',
              429,
            );
          }

          const data = {
            attempts: active ? row.attempts + 1 : 1,
            resetsAt: active
              ? row.resetsAt
              : new Date(now.getTime() + 15 * 60 * 1000),
          };
          await tx.authAttempt.upsert({
            where: { bucket },
            create: { bucket, ...data },
            update: data,
          });
        }
      },
    );
  }
  async register(dto: RegisterDto): Promise<PublicUser> {
    const salt = randomBytes(PASSWORD_SALT_BYTES).toString('hex');
    const passwordHash = `${salt}:${(await derive(dto.password, salt)).toString('hex')}`;
    try {
      return await this.database.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: Role.USER,
        },
        select: publicFields,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Этот email уже зарегистрирован');
      }
      throw error;
    }
  }
  async login(dto: LoginDto): Promise<PublicUser> {
    const user = await this.database.user.findUnique({
      where: { email: dto.email },
    });
    const [salt, storedPasswordHash] = user?.passwordHash.split(':') ?? [
      FAKE_SALT,
      FAKE_PASSWORD_HASH,
    ];
    const candidatePasswordHash = await derive(dto.password, salt);

    const passwordMatches = timingSafeEqual(
      candidatePasswordHash,
      Buffer.from(storedPasswordHash, 'hex'),
    );

    if (!passwordMatches || !user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
  getSessionToken(cookie?: string) {
    return cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.slice(sessionCookie.length + 1);
  }
  async user(cookie?: string): Promise<PublicUser | null> {
    const token = this.getSessionToken(cookie);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const session = await this.database.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: publicFields } },
    });
    return session && session.expiresAt > new Date() ? session.user : null;
  }
  async start(user: PublicUser, previousCookie?: string) {
    const previous = this.getSessionToken(previousCookie);
    const token = randomBytes(32).toString('hex');
    await this.database.$transaction(async (tx) => {
      if (previous)
        await tx.session.deleteMany({
          where: { tokenHash: hashToken(previous) },
        });
      await tx.session.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      await tx.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + sessionLifetime),
        },
      });
    });
    return token;
  }
  async end(cookie?: string) {
    const token = this.getSessionToken(cookie);
    if (token)
      await this.database.session.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
  }
}
