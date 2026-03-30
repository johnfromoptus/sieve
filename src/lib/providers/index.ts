import { MusicProvider } from "./types";
import { spotify } from "./spotify";

const providers: Record<string, MusicProvider> = {
  spotify,
};

export function getProvider(name: string): MusicProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}
