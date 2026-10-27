import { DevToolsPlugin, PluginContext } from './index';

export interface MMKVLike {
  getAllKeys: () => string[];
  getString: (key: string) => string | undefined;
  getNumber?: (key: string) => number | undefined;
  getBoolean?: (key: string) => boolean | undefined;
  delete?: (key: string) => void;
  clearAll: () => void;
  addOnValueChangedListener?: (onValueChanged: (key: string) => void) => { remove: () => void };
}

export interface MMKVPluginOptions {
  id?: string;
  title?: string;
  icon?: string;
}

export function mmkvPlugin(storage: MMKVLike, options: MMKVPluginOptions = {}): DevToolsPlugin {
  const pluginId = options.id || 'mmkv';
  const pluginTitle = options.title || 'MMKV Storage';
  const pluginIcon = options.icon || 'database';

  return {
    id: pluginId,
    title: pluginTitle,
    schema: {
      id: pluginId,
      title: pluginTitle,
      icon: pluginIcon,
      columns: [
        { key: 'key', label: 'Key', type: 'text' },
        { key: 'type', label: 'Type', type: 'badge' },
        { key: 'value', label: 'Value', type: 'json' },
        { key: 'size', label: 'Size', type: 'text' },
        { key: 'timestamp', label: 'Last Modified', type: 'timestamp' },
      ],
      actions: [
        { id: 'refresh', label: 'Reload Keys' },
        { id: 'clear_all', label: 'Wipe Storage' },
      ],
    },
    setup(context: PluginContext) {
      const sync = () => {
        try {
          const keys = storage.getAllKeys();
          const rows = keys.map((key) => {
            let val: any = undefined;
            let type = 'string';

            if (storage.getString) {
              val = storage.getString(key);
            }
            if (val === undefined && storage.getNumber) {
              val = storage.getNumber(key);
              if (val !== undefined) type = 'number';
            }
            if (val === undefined && storage.getBoolean) {
              val = storage.getBoolean(key);
              if (val !== undefined) type = 'boolean';
            }

            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                if (typeof parsed === 'object' && parsed !== null) {
                  val = parsed;
                  type = Array.isArray(parsed) ? 'array' : 'object';
                }
              } catch {}
            }

            const sizeStr = typeof val === 'object'
              ? `${JSON.stringify(val).length} B`
              : `${String(val ?? '').length} B`;

            return {
              key,
              type,
              value: val,
              size: sizeStr,
              timestamp: Date.now(),
            };
          });

          context.send(rows);
        } catch (err) {
          console.error('[DevTools MMKV Plugin] Error reading keys:', err);
        }
      };

      // Initial sync on connect
      sync();

      // Listen for remote Desktop actions
      const unlistenRefresh = context.on('refresh', () => {
        sync();
      });

      const unlistenClear = context.on('clear_all', () => {
        try {
          storage.clearAll();
          sync();
        } catch (err) {
          console.error('[DevTools MMKV Plugin] Error clearing storage:', err);
        }
      });

      let listenerCleanup: (() => void) | undefined;
      if (typeof storage.addOnValueChangedListener === 'function') {
        const sub = storage.addOnValueChangedListener(() => {
          sync();
        });
        listenerCleanup = () => sub?.remove?.();
      }

      return () => {
        unlistenRefresh();
        unlistenClear();
        if (listenerCleanup) listenerCleanup();
      };
    },
  };
}
