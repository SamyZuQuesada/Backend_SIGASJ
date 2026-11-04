import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  bindMediaDataSource,
  ensureMediaBlobTable,
} from './media-blob.store';

@Injectable()
export class MediaBlobBootstrap implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    bindMediaDataSource(this.dataSource);
    await ensureMediaBlobTable();
  }
}
