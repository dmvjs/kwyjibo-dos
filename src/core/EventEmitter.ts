/**
 * Simple Type-Safe Event Emitter
 *
 * A lightweight event system that's fully type-safe.
 * Think of it like addEventListener, but for your custom events.
 *
 * Why build our own?
 * - Full TypeScript support (no 'any' types)
 * - Lightweight (no dependencies)
 * - Easy to understand (< 100 lines)
 * - Perfect for our needs
 */

/**
 * A function that handles an event.
 * The data type depends on which event you're listening to.
 */
type EventHandler<T> = (data: T) => void;

/**
 * Type-safe event emitter.
 *
 * Usage:
 *   // Define your events
 *   interface MyEvents {
 *     'user-login': { username: string };
 *     'user-logout': void;
 *   }
 *
 *   // Create emitter
 *   const events = new EventEmitter<MyEvents>();
 *
 *   // Subscribe
 *   events.on('user-login', (data) => {
 *     console.log(`${data.username} logged in`); // TypeScript knows data.username exists!
 *   });
 *
 *   // Emit
 *   events.emit('user-login', { username: 'alice' });
 */
export class EventEmitter<EventMap extends Record<string, any>> {
  /**
   * Storage for event handlers.
   * Map structure: eventName -> array of handler functions
   */
  private handlers: Map<keyof EventMap, Array<EventHandler<unknown>>> = new Map();

  /**
   * Subscribe to an event.
   *
   * @param event - The event name to listen for
   * @param handler - Function to call when event fires
   * @returns Unsubscribe function (call it to stop listening)
   *
   * Example:
   *   const unsubscribe = emitter.on('progress', (data) => {
   *     console.log(data.percentage);
   *   });
   *
   *   // Later, when you don't want updates anymore:
   *   unsubscribe();
   */
  on<E extends keyof EventMap>(event: E, handler: EventHandler<EventMap[E]>): () => void {
    // Get existing handlers for this event (or create empty array)
    const handlers = this.handlers.get(event) ?? [];

    // Add the new handler
    handlers.push(handler as EventHandler<unknown>);

    // Store it back
    this.handlers.set(event, handlers);

    // Return function that removes this specific handler
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event.
   * Usually you'll use the function returned by on() instead.
   *
   * @param event - The event name
   * @param handler - The exact handler function to remove
   */
  off<E extends keyof EventMap>(event: E, handler: EventHandler<EventMap[E]>): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Filter out this handler
    const filtered = handlers.filter((h) => h !== handler);

    if (filtered.length === 0) {
      // No handlers left, remove the array entirely
      this.handlers.delete(event);
    } else {
      // Update with filtered array
      this.handlers.set(event, filtered);
    }
  }

  /**
   * Subscribe to an event, but only fire once.
   * After the first event, automatically unsubscribes.
   *
   * @param event - The event name to listen for
   * @param handler - Function to call (only once)
   * @returns Unsubscribe function (in case you want to cancel early)
   *
   * Example:
   *   emitter.once('complete', (data) => {
   *     console.log('Done!', data);
   *   });
   */
  once<E extends keyof EventMap>(event: E, handler: EventHandler<EventMap[E]>): () => void {
    // Create a wrapper that unsubscribes after calling the handler
    const wrapper: EventHandler<EventMap[E]> = (data) => {
      handler(data);
      this.off(event, wrapper);
    };

    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all subscribers.
   * All handlers for this event will be called with the data.
   *
   * @param event - The event name
   * @param data - The data to pass to handlers
   *
   * Example:
   *   emitter.emit('progress', { percentage: 50 });
   */
  emit<E extends keyof EventMap>(event: E, data: EventMap[E]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Call each handler with the data
    // Use slice() to avoid issues if a handler unsubscribes during the loop
    for (const handler of handlers.slice()) {
      try {
        handler(data);
      } catch (error) {
        // Don't let one bad handler break the others
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    }
  }

  /**
   * Remove all event handlers.
   * Useful for cleanup when you're done with the emitter.
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of handlers for a specific event.
   * Useful for debugging and testing.
   *
   * @param event - The event name
   * @returns Number of handlers subscribed to this event
   */
  listenerCount<E extends keyof EventMap>(event: E): number {
    return this.handlers.get(event)?.length ?? 0;
  }
}
