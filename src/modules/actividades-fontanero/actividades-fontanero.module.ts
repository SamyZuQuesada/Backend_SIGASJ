import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActividadesFontaneroController } from './actividades-fontanero.controller';
import { ActividadesFontaneroService } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActividadFontanero])],
  controllers: [ActividadesFontaneroController],
  providers: [ActividadesFontaneroService, RolesGuard],
  exports: [TypeOrmModule, ActividadesFontaneroService],
})
export class ActividadesFontaneroModule {}
