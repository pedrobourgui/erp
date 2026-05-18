import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from './event-types';

/**
 * Typed wrapper around @nestjs/event-emitter for application events.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit a typed application event.
   */
  emit<T extends AppEvent>(event: T): boolean {
    this.logger.debug(`Emitting event: ${event.eventName}`);
    return this.eventEmitter.emit(event.eventName, event);
  }

  /**
   * Register a listener for a specific event.
   */
  on<T extends AppEvent>(
    eventName: T['eventName'],
    handler: (event: T) => void | Promise<void>,
  ): void {
    this.eventEmitter.on(eventName, handler);
    this.logger.debug(`Registered handler for event: ${eventName}`);
  }

  /**
   * Register a one-time listener for a specific event.
   */
  once<T extends AppEvent>(
    eventName: T['eventName'],
    handler: (event: T) => void | Promise<void>,
  ): void {
    this.eventEmitter.once(eventName, handler);
  }

  /**
   * Remove a specific listener.
   */
  off<T extends AppEvent>(
    eventName: T['eventName'],
    handler: (event: T) => void | Promise<void>,
  ): void {
    this.eventEmitter.off(eventName, handler);
  }
}
