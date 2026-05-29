import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createDb } from '../db';
import { ConfigService } from '../config/config.service';
import { isDatabaseConnectionError, DATABASE_UNAVAILABLE_MESSAGE } from '../common/db-errors';

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  async health() {
    const db = createDb(this.config.databaseUrl);
    try {
      await db.execute(sql`SELECT 1`);
    } catch (err) {
      if (isDatabaseConnectionError(err)) {
        throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE);
      }
      throw err;
    }
    return { ok: true, service: 'yamma-api' };
  }
}
