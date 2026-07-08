import { Module } from '@nestjs/common';
import { IglesiasController } from './iglesias.controller';
import { IglesiasService } from './iglesias.service';

@Module({
  controllers: [IglesiasController],
  providers: [IglesiasService],
})
export class IglesiasModule {}
