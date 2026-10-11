import React from 'react';

interface HeaderProps {
  title?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function Header({ title = 'RescueConnect', leftAction, rightAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-1 items-center justify-start">
          {leftAction}
        </div>
        <div className="flex items-center justify-center">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
