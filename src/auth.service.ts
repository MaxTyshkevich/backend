import { BadRequestException, ConflictException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from './database.service';

export interface PublicUser { id: string; email: string; name: string }
type UserRow = PublicUser & { password_hash: string };
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionCookie = 'microfronts_session';
export const sessionLifetime = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }
  credentials(body: unknown, registration = false) {
    const input = body as Record<string, unknown> | null;
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Укажите корректный email');
    if (password.length < 12 || password.length > 128) throw new BadRequestException('Пароль должен содержать от 12 до 128 символов');
    if (registration && (name.length < 1 || name.length > 80)) throw new BadRequestException('Имя должно содержать от 1 до 80 символов');
    return { email, password, name };
  }
  limit(ip: string, email: string) {
    const now = Date.now();
    this.db.prepare('DELETE FROM auth_attempts WHERE resets_at <= ?').run(now);
    for (const [bucket, maximum] of [[`ip:${ip}`, 40], [`email:${email}`, 10]] as const) {
      const row = this.db.prepare('SELECT attempts FROM auth_attempts WHERE bucket = ?').get(bucket);
      if (row && Number(row.attempts) >= maximum) throw new HttpException('Слишком много попыток. Повторите через 15 минут.', 429);
      this.db.prepare('INSERT INTO auth_attempts VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1').run(bucket, now + 15 * 60 * 1000);
    }
  }
  async register(input: ReturnType<AuthService['credentials']>): Promise<PublicUser> {
    const salt = randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${(await derive(input.password, salt)).toString('hex')}`;
    const user = { id: randomUUID(), email: input.email, name: input.name };
    try { this.db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(user.id, user.email, user.name, passwordHash); }
    catch (error) {
      if (this.db.prepare('SELECT id FROM users WHERE email = ?').get(input.email)) throw new ConflictException('Этот email уже зарегистрирован');
      throw error;
    }
    return user;
  }
  async login(input: ReturnType<AuthService['credentials']>): Promise<PublicUser> {
    const user = this.db.prepare('SELECT * FROM users WHERE email = ?').get(input.email) as UserRow | undefined;
    const [salt, stored] = user?.password_hash.split(':') ?? ['00000000000000000000000000000000', '00'.repeat(64)];
    const candidate = await derive(input.password, salt);
    if (!timingSafeEqual(candidate, Buffer.from(stored, 'hex')) || !user) throw new UnauthorizedException('Неверный email или пароль');
    return { id: user.id, email: user.email, name: user.name };
  }
  token(cookie?: string) { return cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1); }
  user(cookie?: string): PublicUser | null {
    const token = this.token(cookie);
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    return this.db.prepare(`SELECT u.id, u.email, u.name FROM users u JOIN sessions s ON s.user_id = u.id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(hashToken(token), Date.now()) as unknown as PublicUser ?? null;
  }
  start(user: PublicUser, previousCookie?: string) {
    this.end(previousCookie);
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hashToken(token), user.id, Date.now() + sessionLifetime);
    return token;
  }
  end(cookie?: string) {
    const token = this.token(cookie);
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
}
