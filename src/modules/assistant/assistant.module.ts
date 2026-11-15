import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AdminAssistantController } from './admin-assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  controllers: [AssistantController, AdminAssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
