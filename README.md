# @archie-dev/react-native-core

Zero-native client SDK and extensible plugin engine for React Native in **Unified DevTools**.

Connects your React Native app directly to the **React Native Desktop DevTools** companion app over high-performance WebSockets with zero CocoaPods, zero Gradle configs, and zero native rebuilds. Fully compatible with the React Native 0.83+ New Architecture (Fabric & Bridgeless mode).

---

## Features

- **Zero Native Dependencies**: 100% pure TypeScript/JavaScript. No iOS pods, no Android Gradle modifications, no native recompilation.
- **Smart Host Auto-Discovery**:
  - Automatically targets `10.0.2.2` for Android Emulators.
  - Automatically parses development host IP from `NativeModules.SourceCode.scriptURL` for physical devices over Wi-Fi.
  - Defaults to `127.0.0.1` for iOS Simulators.
- **Console Interception**: Non-destructively intercepts `console.log`, `info`, `warn`, `error`, and `debug` with cycle-safe serialization, stack trace capture, and offline queuing.
- **Extensible Custom Plugin Engine**: Build custom debugging panels (Feature Flags, MMKV/AsyncStorage explorer, Analytics loggers) in your mobile code without writing a single line of desktop code.
- **Resilient Offline Queue**: Buffers events when the desktop app is closed and flushes them automatically upon reconnection.

---

## Installation

```bash
# npm
npm install -D @archie-dev/react-native-core

# yarn
yarn add -D @archie-dev/react-native-core

# pnpm
pnpm add -D @archie-dev/react-native-core
```

---

## Quick Start

Initialize the DevTools client in your root entry file (e.g., `index.js` or `App.tsx`) before other modules load:

```typescript
import { initDevTools } from '@archie-dev/react-native-core';

if (__DEV__) {
  initDevTools({
    port: 9020,
    enableConsole: true,
    autoReconnect: true,
  });
}
```

---

## Custom Plugin API

Create custom inspector panels inside **React Native Desktop DevTools** directly from React Native:

```typescript
import { defineCustomPlugin, initDevTools } from '@archie-dev/react-native-core';

// 1. Define your custom plugin schema and behavior
const featureFlagPlugin = defineCustomPlugin({
  id: 'feature-flags',
  title: 'Feature Flags',
  icon: 'toggle-left',
  columns: [
    { key: 'flag', label: 'Feature Flag', type: 'text' },
    { key: 'status', label: 'State', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'timestamp' },
  ],
  actions: [
    { id: 'toggle-new-onboarding', label: 'Toggle New Onboarding' },
    { id: 'reset-flags', label: 'Reset All Flags' },
  ],
  setup: (context) => {
    // Send initial state or telemetry to desktop table
    context.send({
      flag: 'new_checkout_flow',
      status: 'enabled',
      updatedAt: Date.now(),
    });

    // Listen for desktop button clicks/actions
    const unsubscribe = context.on('toggle-new-onboarding', () => {
      console.log('Toggled onboarding flag from Desktop DevTools!');
      context.send({
        flag: 'new_onboarding',
        status: 'enabled',
        updatedAt: Date.now(),
      });
    });

    return () => {
      unsubscribe();
    };
  },
});

// 2. Register the plugin during initialization
initDevTools({
  plugins: [featureFlagPlugin],
});
```

---

## Android Physical Devices

When testing on a physical Android device connected via USB, forward WebSocket port `9020`:

```bash
adb reverse tcp:9020 tcp:9020
```

---

## API Reference

### `initDevTools(options?: DevToolsOptions)`

Starts the client WebSocket connection and sets up event interceptors.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `host` | `string` | Auto-detected | Override destination WebSocket host IP |
| `port` | `number` | `9020` | WebSocket port matching Desktop app |
| `enableConsole` | `boolean` | `true` | Intercept and forward console logs to desktop |
| `autoReconnect` | `boolean` | `true` | Automatically retry connection every 3 seconds |
| `plugins` | `DevToolsPlugin[]` | `[]` | Array of custom plugins to register |

### `defineCustomPlugin(config)`

Helper to construct a type-safe `DevToolsPlugin` object with UI schema and setup lifecycle.

### `unifiedDevTools`

The singleton instance of `UnifiedDevToolsClient`:
- `unifiedDevTools.registerPlugin(plugin: DevToolsPlugin)`
- `unifiedDevTools.sendPacket(packet: any)`
- `unifiedDevTools.disconnect()`

---

## License

MIT © [Unified DevTools Team](https://github.com/unified-devtools)
