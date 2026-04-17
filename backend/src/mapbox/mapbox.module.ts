import { Module } from '@nestjs/common';
import { MapboxService } from './mapbox.service';
import { MapboxController } from './mapbox.controller';

@Module({
  providers: [MapboxService],
  controllers: [MapboxController],
  exports: [MapboxService],
})
export class MapboxModule {}
