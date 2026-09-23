import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from './safe-storage';

export interface ApiSettingsState {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  clearApiKey: () => void;
}

const useApiSettingsStore = create<ApiSettingsState>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (key: string | null) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: null }),
    }),
    {
      name: 'app-api-settings',
      storage: createJSONStorage(() => safeLocalStorage as unknown as Storage),
      skipHydration: true,
    }
  )
);

export default useApiSettingsStore;
export { useApiSettingsStore };