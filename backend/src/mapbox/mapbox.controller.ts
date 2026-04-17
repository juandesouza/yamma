import { Controller, Get, Query } from '@nestjs/common';
import { MapboxService } from './mapbox.service';

@Controller('mapbox')
export class MapboxController {
  constructor(private mapbox: MapboxService) {}

  @Get('geocode')
  async geocode(@Query('q') q: string, @Query('limit') limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 5;
    return this.mapbox.geocode(q ?? '', Number.isFinite(lim) ? lim : 5);
  }

  @Get('reverse')
  async reverse(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    return this.mapbox.reverseGeocode(latitude, longitude);
  }

  @Get('route')
  async route(
    @Query('fromLat') fromLat: string,
    @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string,
    @Query('toLng') toLng: string,
  ) {
    return this.mapbox.getDistanceAndEta(
      { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
      { lat: parseFloat(toLat), lng: parseFloat(toLng) },
    );
  }
}
