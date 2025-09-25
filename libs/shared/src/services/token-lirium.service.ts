import { Injectable } from '@nestjs/common';
import { TokenLiriumDto } from '../dto/token.dto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as jwt from 'jsonwebtoken';
export abstract class TokenLiriumServiceAbstract {
  abstract getToken(): Promise<TokenLiriumDto>;
}

@Injectable()
export class TokenLiriumService extends TokenLiriumServiceAbstract {
  private readonly apiKey: string;
  private readonly privateKeyPem: string;
  private token: string | null = null;
  private expireAt = 0;
  public constructor() {
    super();
    const apiKey: string | undefined = process.env.LIRIUM_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('LIRIUM_API_KEY is required.');
    }

    const pem: string = this.resolvePrivateKeyPem({
      b64: process.env.LIRIUM_PRIVATE_KEY_B64,
      path: process.env.LIRIUM_PRIVATE_KEY_PATH,
      raw: process.env.LIRIUM_PRIVATE_KEY,
    });

    this.apiKey = apiKey;
    this.privateKeyPem = pem;
  }

  async getToken(): Promise<TokenLiriumDto> {
    const now = Math.floor(Date.now() / 1000);

    if (this.token && now < this.expireAt) {
      console.log('Token is still valid');
      return { token: this.token };
    }
    const payload: Record<string, number | string> = {
      iss: this.apiKey,
      iat: Math.floor(Date.now() / 1000),
    };

    try {
      const token: string = jwt.sign(payload, this.privateKeyPem, {
        algorithm: 'RS512',
      });

      const dto: TokenLiriumDto = { token };
      this.expireAt = now + 840;
      this.token = token;
      return dto;
    } catch (err) {
      // Add minimal context, avoid leaking PEM
      const message: string =
        err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Failed to sign Lirium JWT (RS512): ${message}`);
    }
  }

  private resolvePrivateKeyPem(source: {
    readonly b64?: string;
    readonly path?: string;
    readonly raw?: string;
  }): string {
    if (source.b64 && source.b64.trim().length > 0) {
      const decoded: string = Buffer.from(source.b64, 'base64').toString(
        'utf8',
      );
      return decoded.trim();
    }

    // 2) Path to file
    if (source.path && source.path.trim().length > 0) {
      const absolute: string = path.isAbsolute(source.path)
        ? source.path
        : path.resolve(process.cwd(), source.path);

      if (!fs.existsSync(absolute)) {
        throw new Error(`Lirium private key file not found at: ${absolute}`);
      }
      const pem: string = fs.readFileSync(absolute, 'utf8');
      return pem.trim();
    }

    // 3) Raw with \n escaped
    if (source.raw && source.raw.trim().length > 0) {
      return source.raw.replace(/\\n/g, '\n').trim();
    }

    throw new Error(
      'Provide one of: LIRIUM_PRIVATE_KEY_B64 (preferred), LIRIUM_PRIVATE_KEY_PATH, or LIRIUM_PRIVATE_KEY.',
    );
  }
}
