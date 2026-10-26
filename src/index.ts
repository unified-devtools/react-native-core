import { NativeModules, Platform } from 'react-native';

export interface CustomPluginColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'timestamp' | 'badge' | 'json';
}

export interface CustomPluginAction {
  id: string;
  label: string;
  icon?: string;
}

export interface CustomPluginSchema {
  id: string;
  title: string;
  icon?: string;
  columns: CustomPluginColumn[];
  actions: CustomPluginAction[];
}

export interface PluginContext {
  send: (event: any) => void;
  on: (actionId: string, handler: (payload: any) => void) => () => void;
}

export interface DevToolsPlugin {
  id: string;
  title: string;
  schema?: CustomPluginSchema;
  setup?: (context: PluginContext) => (() => void) | void;
}

export interface DevToolsOptions {
  host?: string;
  port?: number;
  plugins?: DevToolsPlugin[];
  autoReconnect?: boolean;
}

class UnifiedDevToolsClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimer: any = null;
  private options: DevToolsOptions = {};
  private plugins: Map<string, DevToolsPlugin> = new Map();
  private actionHandlers: Map<string, Map<string, (payload: any) => void>> = new Map();
  private cleanupFns: (() => void)[] = [];
  private offlineQueue: string[] = [];

  public init(options: DevToolsOptions = {}) {
    if (this.ws) return;
    this.options = {
      port: 9020,
      autoReconnect: true,
      ...options,
    };

    if (options.plugins) {
      options.plugins.forEach((p) => this.registerPlugin(p));
    }

    this.connect();
  }

  public registerPlugin(plugin: DevToolsPlugin) {
    this.plugins.set(plugin.id, plugin);

    if (plugin.setup) {
      const pluginHandlers = new Map<string, (payload: any) => void>();
      this.actionHandlers.set(plugin.id, pluginHandlers);

      const context: PluginContext = {
        send: (event: any) => {
          this.sendPacket({
            type: 'custom:event',
            payload: {
              pluginId: plugin.id,
              event,
            },
          });
        },
        on: (actionId: string, handler: (payload: any) => void) => {
          pluginHandlers.set(actionId, handler);
          return () => pluginHandlers.delete(actionId);
        },
      };

      const cleanup = plugin.setup(context);
      if (typeof cleanup === 'function') {
        this.cleanupFns.push(cleanup);
      }
    }

    // If already connected, sync new plugin schema
    if (this.isConnected && plugin.schema) {
      this.sendHandshake();
    }
  }

  private resolveHost(): string {
    if (this.options.host) return this.options.host;

    if (Platform.OS === 'android') {
      return '10.0.2.2';
    }

    try {
      const scriptURL = NativeModules?.SourceCode?.scriptURL;
      if (scriptURL) {
        const address = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
        if (address && address !== 'localhost' && address !== '127.0.0.1') {
          return address;
        }
      }
    } catch {}

    return '127.0.0.1';
  }

  private connect() {
    const host = this.resolveHost();
    const port = this.options.port || 9020;
    const url = `ws://${host}:${port}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendHandshake();
        this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handleInbound(packet);
        } catch {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.ws = null;
        if (this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public sendPacket(packet: any) {
    const data = JSON.stringify(packet);
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      if (this.offlineQueue.length > 500) this.offlineQueue.shift();
      this.offlineQueue.push(data);
    }
  }

  private flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.offlineQueue.length > 0) {
      const item = this.offlineQueue.shift();
      if (item) this.ws.send(item);
    }
  }

  private sendHandshake() {
    const schemas: CustomPluginSchema[] = [];
    this.plugins.forEach((p) => {
      if (p.schema) schemas.push(p.schema);
    });

    this.sendPacket({
      type: 'client:handshake',
      payload: {
        appName: 'React Native App',
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        deviceName: Platform.select({
          ios: 'iOS Simulator',
          android: 'Android Device',
          default: 'Mobile Device',
        }),
        customPlugins: schemas,
      },
    });
  }

  private handleInbound(packet: any) {
    if (packet.type === 'custom:action') {
      const { pluginId, actionId, payload } = packet.payload;
      const handlers = this.actionHandlers.get(pluginId);
      if (handlers) {
        const handler = handlers.get(actionId);
        if (handler) {
          handler(payload);
        }
      }
    }
  }

  public destroy() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const unifiedDevTools = new UnifiedDevToolsClient();

export function initDevTools(options?: DevToolsOptions) {
  unifiedDevTools.init(options);
}

export function defineCustomPlugin(config: {
  id: string;
  title: string;
  icon?: string;
  columns: CustomPluginColumn[];
  actions?: CustomPluginAction[];
  setup?: (context: PluginContext) => (() => void) | void;
}): DevToolsPlugin {
  return {
    id: config.id,
    title: config.title,
    schema: {
      id: config.id,
      title: config.title,
      icon: config.icon,
      columns: config.columns,
      actions: config.actions || [],
    },
    setup: config.setup,
  };
}
