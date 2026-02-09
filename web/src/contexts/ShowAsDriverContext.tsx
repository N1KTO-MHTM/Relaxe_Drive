import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ShowAsDriverContextValue = {
  showAsDriver: boolean;
  setShowAsDriver: (value: boolean) => void;
  toggleShowAsDriver: () => void;
};

const ShowAsDriverContext = createContext<ShowAsDriverContextValue | null>(null);

export function ShowAsDriverProvider({ children }: { children: ReactNode }) {
  const [showAsDriver, setShowAsDriver] = useState(false);
  const toggleShowAsDriver = useCallback(() => setShowAsDriver((v) => !v), []);
  return (
    <ShowAsDriverContext.Provider
      value={{ showAsDriver, setShowAsDriver, toggleShowAsDriver }}
    >
      {children}
    </ShowAsDriverContext.Provider>
  );
}

export function useShowAsDriver(): ShowAsDriverContextValue | null {
  return useContext(ShowAsDriverContext);
}
