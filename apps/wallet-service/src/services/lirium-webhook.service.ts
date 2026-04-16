import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from 'libs/shared';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';

type JwtClaims = {
  digest?: string;
  iat?: number;
  iss?: string;
};

type LiriumReceiveOrder = {
  asset?: {
    amount?: string;
    currency?: string;
  };
  customer_id?: string;
  id?: string;
  operation?: string;
  receive?: {
    origin?: {
      amount?: string;
      type?: string;
      value?: string;
    };
  };
  state?: string;
};

type LiriumWebhookEvent = {
  action?: string;
  id?: string;
  order?: LiriumReceiveOrder;
};

type UserRow = {
  company_id: string;
  user_id: string;
};

const DEFAULT_MAX_SIGNATURE_AGE_SECONDS = 300;
const LIRIUM_WEBHOOK_PUBLIC_KEYS: Record<string, string> = {
  'lirium-production': [
    '-----BEGIN PUBLIC KEY-----',
    'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA8Q5gOdGdNdpTkapOMWGv',
    'JP45MziiEVmGbYZk/Q+pJCtB3Xogwni/cHSDHhU+hZO2cWlSnwaDqjxbz4LFIrt2',
    'fjV1OLWdkCBKQI7KXpuFW+7jFSTS7xNlWCp3Elt526LhlKqT0fB3mDDHilecjQfg',
    'PQJtWs2rgvOQP0VsKFU3u+RBdegQic+06ommKCNoaGVbVJMcMNsXzW/CecvCfEyv',
    '1Tk9wmTgKhQptu5TQuybHKiXBb3QcxelRQ9imCM76uejzSgQdGXwkTOoa3Fex1GY',
    'TdcmgOKlTWbNyPZjjVyP9im6BaL2d4XfOqgjiCEd0cXUWYsuop6Lu8FlKtnKNYP5',
    'Aki0fu8+NRQHooMho1KO3DGdvhADWeg9GnWjlTpeIl8yCAG3Qr/ARh9kswhUfxAd',
    '+uFIDeJ1N94uqSLGboatP/C6dJhiBTk17JBkeeKwGu1KkA6zI3yhP27GQVuhFrgo',
    'PyfZ5nznjfLT1gtda1/wQgxvushR78QG2h3GsuuEqR8/QH4ZfU8fizY94I9PvjoM',
    'DNUPYrz34bRVbJVvWkxFBx1Fod97zpl3dEzwBZSvX337DwGkx21jnq0hF2ctAMyV',
    'KiukCrT9o7p16c7LENuCk5K1H2R7nfa+5vnw9ZGg7N59WySmEsSxjyG8HkJtEy9B',
    'lmjCP56uE0SS+ZoFwGhG/U0CAwEAAQ==',
    '-----END PUBLIC KEY-----',
  ].join('\n'),
  'lirium-sandbox': [
    '-----BEGIN PUBLIC KEY-----',
    'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA1vxtEXpfWKAwGlhGQeJN',
    'llMke22x82GkFBPi9LDw6Kb6NWNfUCmz/tQ9zEPhiMgEfi0lyKO2dYNQQ9uNu895',
    'w7jeNcpRjlDiv56cEp6clZlPxv1BEXP+ETGjpnBZjw00PTQj3JdjSZ2yIhBNDi8Q',
    'cwd3JlJNq2D6qrymDlh6IFaa0rG/G+brIYQGUnsWl6HwlMtMIsqDEigEDF5yhlVo',
    'g1i6tSFnNXXAxHDx/drnFI8giGTDUfF57Yz3bRCsLpOL2el0hZ5AfDE01Kg21Oim',
    'UYAUPUUbSycAOp9f1TGzwJvcTOSBHQNtTzx01/PvxLRiUxih4xKp1g3azUVKCD8K',
    '8EiDtcYkxwGyUTlHx2s+IIr2WOedMZRqOmayxqEb6SefuMakenmURYRZ0nNsegMT',
    'L8POoLo/JynkHlM/fvq8VBHbf04UEGd9l5sy56lEiIYJQVj+4CEUh1kUETh4eO7Q',
    'lMQpjzlE/2Al80uYNipc8BdWHrETIkyh2ovF7Q7a+i8PSIUux1LLrjPiYZy75jk9',
    'GT6bgXGENCCRFEpGEOkOioAWrU/qJBZWqOQ2OcCsI7h+Av3HRGXAYpuaYbxXYuKl',
    '15/s1esoo0EPuKh5mDiA+uK/h4uRby220O2exYqubCRhG/ArKPIOULfUA2Shl5Gx',
    'ioube4bXIWprFVSmgc8b6eUCAwEAAQ==',
    '-----END PUBLIC KEY-----',
  ].join('\n'),
};

@Injectable()
export class LiriumWebhookService {
  constructor(private readonly databaseService: DatabaseService) {}

  async handleWebhook(
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: unknown,
  ): Promise<void> {
    this.validateSignature(signature, rawBody);

    const event = this.parseEvent(payload);
    if (!this.shouldProcessEvent(event)) {
      return;
    }

    const order = event.order!;
    const user = await this.findUser(order.customer_id!);

    await this.databaseService.pool.query(
      `INSERT INTO deposits (
        order_id,
        user_id,
        erc20_amount,
        confirmed,
        amount_usd,
        company_id,
        currency,
        status,
        event_id,
        origin_type,
        origin_value,
        origin_amount,
        payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (order_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        erc20_amount = EXCLUDED.erc20_amount,
        confirmed = EXCLUDED.confirmed,
        amount_usd = EXCLUDED.amount_usd,
        company_id = EXCLUDED.company_id,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        event_id = EXCLUDED.event_id,
        origin_type = EXCLUDED.origin_type,
        origin_value = EXCLUDED.origin_value,
        origin_amount = EXCLUDED.origin_amount,
        payload = EXCLUDED.payload,
        updated_at = CURRENT_TIMESTAMP`,
      [
        order.id,
        user.user_id,
        order.asset?.amount ?? '0',
        this.isConfirmed(event.action, order.state),
        null,
        user.company_id,
        order.asset?.currency ?? null,
        order.state ?? 'pending',
        event.id ?? null,
        order.receive?.origin?.type ?? null,
        order.receive?.origin?.value ?? null,
        order.receive?.origin?.amount ?? null,
        payload,
      ],
    );
  }

  private findUser = async (userId: string): Promise<UserRow> => {
    const result = await this.databaseService.pool.query<UserRow>(
      'SELECT user_id, company_id FROM users WHERE user_id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Lirium webhook user ${userId} was not found`);
    }

    return result.rows[0];
  };

  private isConfirmed(action?: string, state?: string): boolean {
    if (action === 'order-closed') {
      return true;
    }

    const normalizedState = state?.toLowerCase();
    return normalizedState === 'closed' || normalizedState === 'completed';
  }

  private parseEvent(payload: unknown): LiriumWebhookEvent {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid Lirium webhook payload');
    }

    return payload as LiriumWebhookEvent;
  }

  private resolvePublicKey(issuer: string): string {
    if (issuer === 'lirium-sandbox' && process.env.LIRIUM_WEBHOOK_PUBLIC_KEY_SANDBOX) {
      return process.env.LIRIUM_WEBHOOK_PUBLIC_KEY_SANDBOX;
    }

    if (issuer === 'lirium-production' && process.env.LIRIUM_WEBHOOK_PUBLIC_KEY_PRODUCTION) {
      return process.env.LIRIUM_WEBHOOK_PUBLIC_KEY_PRODUCTION;
    }

    const publicKey = LIRIUM_WEBHOOK_PUBLIC_KEYS[issuer];
    if (!publicKey) {
      throw new UnauthorizedException(`Unknown Lirium webhook issuer: ${issuer}`);
    }

    return publicKey;
  }

  private shouldProcessEvent(event: LiriumWebhookEvent): boolean {
    if (!event.order || event.order.operation !== 'receive' || !event.order.id) {
      return false;
    }

    return (
      event.action === 'incoming-funds' ||
      event.action === 'order-updated' ||
      event.action === 'order-closed'
    );
  }

  private validateSignature(signature: string | undefined, rawBody: Buffer | undefined): void {
    if (!signature) {
      throw new UnauthorizedException('Missing X-JWT-SIGNATURE header');
    }

    if (!rawBody || rawBody.length === 0) {
      throw new UnauthorizedException('Missing raw request body for signature validation');
    }

    const decoded = jwt.decode(signature) as JwtClaims | null;
    if (!decoded?.iss) {
      throw new UnauthorizedException('Invalid Lirium webhook signature payload');
    }

    const publicKey = this.resolvePublicKey(decoded.iss);
    const verified = jwt.verify(signature, publicKey, {
      algorithms: ['RS512'],
    }) as JwtClaims;

    if (!verified.digest || typeof verified.iat !== 'number' || !verified.iss) {
      throw new UnauthorizedException('Invalid Lirium webhook signature claims');
    }

    const now = Math.floor(Date.now() / 1000);
    const maxAge = Number(process.env.LIRIUM_WEBHOOK_MAX_SIGNATURE_AGE_SECONDS ?? DEFAULT_MAX_SIGNATURE_AGE_SECONDS);
    if (Math.abs(now - verified.iat) > maxAge) {
      throw new UnauthorizedException('Expired Lirium webhook signature');
    }

    const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
    if (digest !== verified.digest) {
      throw new UnauthorizedException('Invalid Lirium webhook body digest');
    }
  }
}
