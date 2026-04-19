import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  /** Lemon Squeezy signs the raw JSON body; without this, HMAC verification always fails. */
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.use(cookieParser(config.sessionSecret));
  app.enableCors({
    // In dev, reflect the request origin so OAuth / API work when opening the app via LAN IP (e.g. 192.168.x.x).
    origin:
      config.env === 'development'
        ? true
        : [config.apiUrl, config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  const host = '0.0.0.0';
  await app.listen(config.port, host);
  console.log(`Backend listening on http://${host}:${config.port} (reachable at http://<this-machine-LAN-IP>:${config.port})`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
