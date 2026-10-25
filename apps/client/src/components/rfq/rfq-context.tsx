'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface RfqProductTarget {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
}

interface RfqContextType {
  isOpen: boolean;
  targetProduct: RfqProductTarget | null;
  openRfq: (product?: RfqProductTarget) => void;
  closeRfq: () => void;
}

const RfqContext = createContext<RfqContextType | null>(null);

export function RfqProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<RfqProductTarget | null>(null);

  const openRfq = useCallback((product?: RfqProductTarget) => {
    setTargetProduct(product || null);
    setIsOpen(true);
  }, []);

  const closeRfq = useCallback(() => {
    setIsOpen(false);
    setTargetProduct(null);
  }, []);

  return (
    <RfqContext.Provider value={{ isOpen, targetProduct, openRfq, closeRfq }}>
      {children}
    </RfqContext.Provider>
  );
}

export function useRfq() {
  const context = useContext(RfqContext);
  if (!context) {
    throw new Error('useRfq must be used within an RfqProvider');
  }
  return context;
}

