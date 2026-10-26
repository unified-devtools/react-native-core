"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedDevTools = void 0;
exports.initDevTools = initDevTools;
exports.defineCustomPlugin = defineCustomPlugin;
const react_native_1 = require("react-native");
class UnifiedDevToolsClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.options = {};
        this.plugins = new Map();
        this.actionHandlers = new Map();
        this.cleanupFns = [];
        this.offlineQueue = [];
    }
    init(options = {}) {
        if (this.ws)
            return;
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
    registerPlugin(plugin) {
        this.plugins.set(plugin.id, plugin);
        if (plugin.setup) {
            const pluginHandlers = new Map();
            this.actionHandlers.set(plugin.id, pluginHandlers);
            const context = {
                send: (event) => {
                    this.sendPacket({
                        type: 'custom:event',
                        payload: {
                            pluginId: plugin.id,
                            event,
                        },
                    });
                },
                on: (actionId, handler) => {
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
    resolveHost() {
        if (this.options.host)
            return this.options.host;
        if (react_native_1.Platform.OS === 'android') {
            return '10.0.2.2';
        }
        try {
            const scriptURL = react_native_1.NativeModules?.SourceCode?.scriptURL;
            if (scriptURL) {
                const address = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
                if (address && address !== 'localhost' && address !== '127.0.0.1') {
                    return address;
                }
            }
        }
        catch { }
        return '127.0.0.1';
    }
    connect() {
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
                }
                catch { }
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
        }
        catch {
            if (this.options.autoReconnect) {
                this.scheduleReconnect();
            }
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }
    sendPacket(packet) {
        const data = JSON.stringify(packet);
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
        else {
            if (this.offlineQueue.length > 500)
                this.offlineQueue.shift();
            this.offlineQueue.push(data);
        }
    }
    flushQueue() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        while (this.offlineQueue.length > 0) {
            const item = this.offlineQueue.shift();
            if (item)
                this.ws.send(item);
        }
    }
    sendHandshake() {
        const schemas = [];
        this.plugins.forEach((p) => {
            if (p.schema)
                schemas.push(p.schema);
        });
        this.sendPacket({
            type: 'client:handshake',
            payload: {
                appName: 'React Native App',
                platform: react_native_1.Platform.OS,
                osVersion: String(react_native_1.Platform.Version),
                deviceName: react_native_1.Platform.select({
                    ios: 'iOS Simulator',
                    android: 'Android Device',
                    default: 'Mobile Device',
                }),
                customPlugins: schemas,
            },
        });
    }
    handleInbound(packet) {
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
    destroy() {
        this.cleanupFns.forEach((fn) => fn());
        this.cleanupFns = [];
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}
exports.unifiedDevTools = new UnifiedDevToolsClient();
function initDevTools(options) {
    exports.unifiedDevTools.init(options);
}
function defineCustomPlugin(config) {
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
