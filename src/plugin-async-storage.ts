import { DevToolsPlugin, PluginContext } from './index';

declare const require: any;

export interface AsyncStorageLike {
  getAllKeys: () => Promise<readonly string[] | string[]>;
  multiGet: (keys: readonly string[] | string[]) => Promise<readonly [string, string | null][] | [string, string | null][]>;
  clear: () => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
}

export interface AsyncStoragePluginOptions {
  id?: string;
  title?: string;
  icon?: string;
}

export function asyncStoragePlugin(
  instance?: AsyncStorageLike,
  options: AsyncStoragePluginOptions = {}
): DevToolsPlugin {
  const pluginId = options.id || 'async_storage';
  const pluginTitle = options.title || 'AsyncStorage';
  const pluginIcon = options.icon || 'layers';

  return {
    id: pluginId,
    title: pluginTitle,
    schema: {
      id: pluginId,
      title: pluginTitle,
      icon: pluginIcon,
      columns: [
        { key: 'key', label: 'Storage Key', type: 'text' },
        { key: 'value', label: 'Value', type: 'json' },
        { key: 'bytes', label: 'Bytes', type: 'number' },
        { key: 'timestamp', label: 'Timestamp', type: 'timestamp' },
      ],
      actions: [
        { id: 'refresh', label: 'Reload Keys' },
        { id: 'clear', label: 'Clear All' },
      ],
    },
    setup(context: PluginContext) {
      const getStorage = (): AsyncStorageLike | null => {
        if (instance) return instance;
        try {
          return require('@react-native-async-storage/async-storage').default;
        } catch {
          console.warn('[DevTools AsyncStorage Plugin] @react-native-async-storage/async-storage not found. Please pass instance: asyncStoragePlugin(AsyncStorage)');
          return null;
        }
      };

      const sync = async () => {
        const storage = getStorage();
        if (!storage) return;

        try {
          const keys = await storage.getAllKeys();
          const pairs = await storage.multiGet(keys);

          const rows = pairs.map(([key, rawVal]) => {
            let val: any = rawVal;
            if (typeof rawVal === 'string') {
              try {
                val = JSON.parse(rawVal);
              } catch {}
            }

            return {
              key,
              value: val,
              bytes: (rawVal || '').length,
              timestamp: Date.now(),
            };
          });

          context.send(rows);
        } catch (err) {
          console.error('[DevTools AsyncStorage Plugin] Error reading keys:', err);
        }
      };

      // Initial sync on connect
      sync();

      // Auto-sync if storage supports subscription/events
      let unsubStorage: (() => void) | undefined;
      const storageInstance = getStorage();
      if (storageInstance && typeof (storageInstance as any).subscribe === 'function') {
        const unsub = (storageInstance as any).subscribe(() => {
          sync();
        });
        unsubStorage = typeof unsub === 'function' ? unsub : undefined;
      }

      // Listen for remote Desktop actions
      const unlistenRefresh = context.on('refresh', () => {
        sync();
      });

      const unlistenClear = context.on('clear', async () => {
        const storage = getStorage();
        if (!storage) return;
        try {
          await storage.clear();
          sync();
        } catch (err) {
          console.error('[DevTools AsyncStorage Plugin] Error clearing storage:', err);
        }
      });

      return () => {
        unlistenRefresh();
        unlistenClear();
        if (unsubStorage) unsubStorage();
      };
    },
  };
}
