import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
  // Panel visibility
  activityBarExpanded: boolean;
  setActivityBarExpanded: (expanded: boolean) => void;
  sidePanelVisible: boolean;
  setSidePanelVisible: (visible: boolean) => void;
  bottomPanelVisible: boolean;
  setBottomPanelVisible: (visible: boolean) => void;

  // Panel sizes
  sidePanelWidth: number;
  setSidePanelWidth: (width: number) => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;

  // Selected tool
  selectedTool: string;
  setSelectedTool: (tool: string) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [activityBarExpanded, setActivityBarExpanded] = useState(false);
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [sidePanelWidth, setSidePanelWidth] = useState(250);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [selectedTool, setSelectedTool] = useState('photo');

  const value = {
    activityBarExpanded,
    setActivityBarExpanded,
    sidePanelVisible,
    setSidePanelVisible,
    bottomPanelVisible,
    setBottomPanelVisible,
    sidePanelWidth,
    setSidePanelWidth,
    bottomPanelHeight,
    setBottomPanelHeight,
    selectedTool,
    setSelectedTool,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};
