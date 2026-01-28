import React from 'react';
import { ProviderLogo } from './ProviderLogo';

// Test component to verify all provider logos render correctly
export const ProviderLogoTest: React.FC = () => {
  const providers = ['openai', 'anthropic', 'google', 'groq', 'cerebras', 'openrouter'] as const;
  
  return (
    <div className="flex flex-wrap gap-4 p-4">
      {providers.map((provider) => (
        <div key={provider} className="flex flex-col items-center gap-2">
          <ProviderLogo provider={provider} size={32} />
          <span className="text-xs capitalize">{provider}</span>
        </div>
      ))}
    </div>
  );
};