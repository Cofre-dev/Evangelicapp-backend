import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { DepartamentosController } from './departamentos.controller';
import { DepartamentosService } from './departamentos.service';
import { FinanzasImportService } from './finanzas-import.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { ReporteCongregacionSuscripcionController } from './reporte-congregacion/reporte-congregacion-suscripcion.controller';
import { ReporteCongregacionController } from './reporte-congregacion/reporte-congregacion.controller';
import { ReporteCongregacionCron } from './reporte-congregacion/reporte-congregacion.cron';
import { ReporteCongregacionService } from './reporte-congregacion/reporte-congregacion.service';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [
    CategoriasController,
    DepartamentosController,
    MovimientosController,
    ReporteCongregacionController,
    ReporteCongregacionSuscripcionController,
  ],
  providers: [
    CategoriasService,
    DepartamentosService,
    MovimientosService,
    FinanzasImportService,
    ReporteCongregacionService,
    ReporteCongregacionCron,
  ],
})
export class FinanzasModule {}
