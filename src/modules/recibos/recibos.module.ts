import { Module } from '@nestjs/common';
import { RecibosController } from './controllers/recibos.controller';
import { RecibosService } from './services/recibos.service';
import { AcueductosCrService } from './services/acueductos-cr.service';
import { RecibosRateLimiterGuard } from './guards/recibos-rate-limiter.guard';

@Module({
  controllers: [RecibosController],
  providers: [RecibosService, AcueductosCrService, RecibosRateLimiterGuard],
  exports: [RecibosService, AcueductosCrService],
})
export class RecibosModule {}
