'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Map, UserCircle, Activity } from 'lucide-react';

// Example items for Citizen or Responder
export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'SOS', href: '/', icon: AlertCircle },
    { label: 'Map', href: '/map', icon: Map },
    { label: 'Status', href: '/status', icon: Activity },
    { label: 'Profile', href: '/profile', icon: UserCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-background/90 backdrop-blur-md md:hidden pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-6 w-6 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
