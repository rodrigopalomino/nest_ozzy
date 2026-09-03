import { Module } from '@nestjs/common';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [LeadController],
  providers: [LeadService, WhatsappService],
})
export class LeadModule {}
