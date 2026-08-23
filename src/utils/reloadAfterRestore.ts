import { Capacitor } from '@capacitor/core';

type ReloadLocation = Pick<Location, 'origin' | 'reload' | 'replace'>;

type ReloadAfterRestoreOptions = {
    isNative?: boolean;
    location?: ReloadLocation;
};

export const nativeAppRootUrl = (origin: string): string => new URL('/', origin).href;

export const reloadAfterRestore = ({
    isNative = Capacitor.isNativePlatform(),
    location = window.location,
}: ReloadAfterRestoreOptions = {}): void => {
    if (isNative) {
        // Native uses BrowserRouter and a relative asset base. Reloading a nested
        // route would resolve ./assets under /tabs, so always return to origin.
        location.replace(nativeAppRootUrl(location.origin));
        return;
    }

    // Web uses HashRouter, so reloading preserves the deployed base and route.
    location.reload();
};
