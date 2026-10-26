declare module 'react-native' {
  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web' | 'other';
    Version: string | number;
    select: <T>(spec: { ios?: T; android?: T; default?: T; [key: string]: any }) => T;
  };
  export const NativeModules: {
    SourceCode?: {
      scriptURL?: string;
    };
    [key: string]: any;
  };
}
