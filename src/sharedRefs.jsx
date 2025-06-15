import { createContext, useContext, useRef } from "react";

const FinancialRefContext = createContext();

export const FinancialRefProvider = ({ children }) => {
  const financialRef = useRef(null);
  return (
    <FinancialRefContext.Provider value={financialRef}>
      {children}
    </FinancialRefContext.Provider>
  );
};

export const useFinancialRef = (setter = false) => {
  const ref = useContext(FinancialRefContext);
  if (setter) {
    return (refObj) => {
      ref.current = refObj?.current || null;
    };
  }
  return ref;
};
