import fs from 'fs';
import path from 'path';
import { FileWatchEvent, WatchOptions } from '../types/index.js';
import { FileSystem } from '../utils/native.js';
import { logger } from '../core/logger.js';

/**
 * Professional file watching service with debouncing and event filtering
 */
export class FileWatcherService {
  private static instance: FileWatcherService;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay = 300; // milliseconds

  private constructor() {}

  public static getInstance(): FileWatcherService {
    if (!FileWatcherService.instance) {
      FileWatcherService.instance = new FileWatcherService();
    }
    return FileWatcherService.instance;
  }

  /**
   * Start watching a directory for SVG file changes
   */
  public async watchDirectory(
    watchPath: string,
    options: Partial<WatchOptions> = {}
  ): Promise<string> {
    const resolvedPath = path.resolve(watchPath);
    
    if (!(await FileSystem.exists(resolvedPath))) {
      throw new Error(`Watch path does not exist: ${resolvedPath}`);
    }

    const watchId = `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const watcher = fs.watch(resolvedPath, {
        persistent: true,
        recursive: false
      }, (eventType, filename) => {
        if (filename) {
          this.handleFileEvent(watchId, eventType, path.join(resolvedPath, filename));
        }
      });

      this.watchers.set(watchId, watcher);
      this.eventHandlers.set(watchId, []);

      logger.info(`Started watching directory: ${resolvedPath}`);
      return watchId;

    } catch (error) {
      logger.error(`Failed to start watching ${resolvedPath}:`, error);
      throw error;
    }
  }

  /**
   * Handle file system events with debouncing
   */
  private handleFileEvent(watchId: string, eventType: string, filePath: string): void {
    // Only process SVG files
    if (!filePath.endsWith('.svg')) {
      return;
    }

    const debounceKey = `${watchId}-${filePath}`;
    
    // Clear existing timer
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(debounceKey);
      await this.processFileEvent(watchId, eventType, filePath);
    }, this.debounceDelay);

    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * Process debounced file events
   */
  private async processFileEvent(watchId: string, eventType: string, filePath: string): Promise<void> {
    try {
      const exists = await FileSystem.exists(filePath);
      let actualEventType: FileWatchEvent['type'];

      // Determine actual event type
      if (eventType === 'rename') {
        actualEventType = exists ? 'add' : 'unlink';
      } else {
        actualEventType = 'change';
      }

      const event: FileWatchEvent = {
        type: actualEventType,
        filePath,
        timestamp: Date.now()
      };

      logger.debug(`File event: ${actualEventType} - ${path.basename(filePath)}`);
      
      // Emit event to registered handlers
      this.emitEvent(watchId, event);

    } catch (error) {
      logger.error(`Error processing file event for ${filePath}:`, error);
    }
  }

  /**
   * Register an event handler for a specific watcher
   */
  public onFileEvent(watchId: string, handler: (event: FileWatchEvent) => void | Promise<void>): void {
    const handlers = this.eventHandlers.get(watchId) || [];
    handlers.push(handler);
    this.eventHandlers.set(watchId, handlers);
  }

  /**
   * Emit event to all registered handlers
   */
  private emitEvent(watchId: string, event: FileWatchEvent): void {
    const handlers = this.eventHandlers.get(watchId) || [];
    
    for (const handler of handlers) {
      try {
        const result = handler(event);
        // Handle async handlers
        if (result && typeof result.then === 'function') {
          result.catch((error: any) => {
            logger.error(`Error in file event handler:`, error);
          });
        }
      } catch (error) {
        logger.error(`Error in file event handler:`, error);
      }
    }
  }

  /**
   * Stop watching a specific directory
   */
  public stopWatching(watchId: string): void {
    const watcher = this.watchers.get(watchId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchId);
      this.eventHandlers.delete(watchId);
      
      // Clear any pending debounce timers for this watcher
      for (const [key, timer] of this.debounceTimers.entries()) {
        if (key.startsWith(`${watchId}-`)) {
          clearTimeout(timer);
          this.debounceTimers.delete(key);
        }
      }
      
      logger.info(`Stopped watching: ${watchId}`);
    }
  }

  /**
   * Stop all watchers
   */
  public stopAllWatchers(): void {
    for (const watchId of this.watchers.keys()) {
      this.stopWatching(watchId);
    }
    logger.info('Stopped all file watchers');
  }

  /**
   * Get active watch statistics
   */
  public getWatchStats(): {
    activeWatchers: number;
    pendingEvents: number;
    totalHandlers: number;
  } {
    let totalHandlers = 0;
    for (const handlers of this.eventHandlers.values()) {
      totalHandlers += handlers.length;
    }

    return {
      activeWatchers: this.watchers.size,
      pendingEvents: this.debounceTimers.size,
      totalHandlers
    };
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    this.stopAllWatchers();
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    logger.info('File watcher service shutdown complete');
  }
}

// Export singleton instance
export const fileWatcher = FileWatcherService.getInstance();