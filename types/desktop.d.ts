export {};

declare global {
  interface Window {
    legendsos?: {
      desktop?: boolean;
      platform?: NodeJS.Platform;
      shellVersion?: string;
    };
  }
}
