'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPin, Camera, Bell, ShieldAlert, ArrowRight } from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setStep(1);
        },
        (error) => {
          console.warn('Location error:', error);
          // Allow proceeding even if denied
          setStep(1);
        }
      );
    } else {
      setStep(1);
    }
  };

  const slides = [
    {
      id: 'permissions',
      title: 'RescueConnect needs your location',
      description: 'RescueConnect needs your location to accurately identify where help or flooding is occurring.',
      icon: <MapPin className="h-16 w-16 text-primary mb-6" />,
      content: (
        <div className="space-y-4 w-full">
          <Button onClick={requestLocation} className="w-full" size="lg">
            Allow Location Access
          </Button>
          <Button variant="ghost" onClick={() => setStep(1)} className="w-full">
            Not Now
          </Button>
        </div>
      )
    },
    {
      id: 'welcome',
      title: 'Hello there!',
      description: 'RescueConnect helps communities report flood emergencies and request assistance quickly.',
      icon: <ShieldAlert className="h-16 w-16 text-primary mb-6" />
    },
    {
      id: 'location',
      title: 'Share Your Location',
      description: 'Pinpoint where help or flooding is located so responders can understand where assistance is needed.',
      icon: <MapPin className="h-16 w-16 text-primary mb-6" />
    },
    {
      id: 'report',
      title: 'Report Flooded Areas',
      description: 'Help others by reporting roads, communities, and areas affected by flooding.',
      icon: <Camera className="h-16 w-16 text-primary mb-6" />
    },
    {
      id: 'urgent',
      title: 'Request Urgent Response',
      description: 'When immediate assistance is needed, send an urgent response request with your location and essential information.',
      icon: <Bell className="h-16 w-16 text-emergency mb-6" />
    }
  ];

  const currentSlide = slides[step];

  const nextSlide = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      // Save completion to localStorage
      localStorage.setItem('rescueconnect_onboarding_complete', 'true');
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full text-center">
        {currentSlide.icon}
        <h1 className="text-2xl font-bold tracking-tight mb-4">{currentSlide.title}</h1>
        <p className="text-lg text-muted-foreground mb-8">{currentSlide.description}</p>
        
        {currentSlide.content ? (
          currentSlide.content
        ) : (
          <Button onClick={nextSlide} className="w-full" size="lg">
            {step === slides.length - 1 ? 'Get Started' : 'Next'} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Progress Indicators */}
      {step > 0 && (
        <div className="flex space-x-2 mb-8">
          {slides.slice(1).map((_, idx) => (
            <div 
              key={idx} 
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === step - 1 ? 'w-6 bg-primary' : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
