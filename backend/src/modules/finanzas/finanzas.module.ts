import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoriasController, MovimientosController],
  providers: [CategoriasService, MovimientosService],
})
export class FinanzasModule {}
