/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useRef } from "react";

const FinancialRefContext = createContext();
const BehavioralRefContext = createContext();

export const FinancialRefProvider = ({ children }) => {
  const financialRef = useRef(null);
  const behavioralRef = useRef(null);

  return (
    <FinancialRefContext.Provider value={financialRef}>
      <BehavioralRefContext.Provider value={behavioralRef}>
        {children}
      </BehavioralRefContext.Provider>
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

export const useBehavioralRef = (setter = false) => {
  const ref = useContext(BehavioralRefContext);
  if (setter) {
    return (refObj) => {
      ref.current = refObj?.current || null;
    };
  }
  return ref;
};
