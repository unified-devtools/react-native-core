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
declare class UnifiedDevToolsClient {
    private ws;
    private isConnected;
    private reconnectTimer;
    private options;
    private plugins;
    private actionHandlers;
    private cleanupFns;
    private offlineQueue;
    init(options?: DevToolsOptions): void;
    registerPlugin(plugin: DevToolsPlugin): void;
    private resolveHost;
    private connect;
    private scheduleReconnect;
    sendPacket(packet: any): void;
    private flushQueue;
    private sendHandshake;
    private handleInbound;
    destroy(): void;
}
export declare const unifiedDevTools: UnifiedDevToolsClient;
export declare function initDevTools(options?: DevToolsOptions): void;
export declare function defineCustomPlugin(config: {
    id: string;
    title: string;
    icon?: string;
    columns: CustomPluginColumn[];
    actions?: CustomPluginAction[];
    setup?: (context: PluginContext) => (() => void) | void;
}): DevToolsPlugin;
export {};
