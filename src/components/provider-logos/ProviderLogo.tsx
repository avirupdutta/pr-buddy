import React from 'react';
import { OpenAILogo } from './OpenAILogo';
import { AnthropicLogo } from './AnthropicLogo';
import { GoogleLogo } from './GoogleLogo';
import { GroqLogo } from './GroqLogo';
import { CerebrasLogo } from './CerebrasLogo';
import { OpenRouterLogo } from './OpenRouterLogo';
import type { AIProviderType } from '@/services/ai-provider-registry';

interface ProviderLogoProps {
  provider: AIProviderType;
  className?: string;
  size?: number;
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({ 
  provider, 
  className = '', 
  size = 20 
}) => {
  const logoProps = { className, size };

  switch (provider) {
    case 'openai':
      return <OpenAILogo {...logoProps} />;
    case 'anthropic':
      return <AnthropicLogo {...logoProps} />;
    case 'google':
      return <GoogleLogo {...logoProps} />;
    case 'groq':
      return <GroqLogo {...logoProps} />;
    case 'cerebras':
      return <CerebrasLogo {...logoProps} />;
    case 'openrouter':
      return <OpenRouterLogo {...logoProps} />;
    default:
      // Fallback for unknown providers
      return (
        <div 
          className={`flex items-center justify-center bg-muted rounded-full ${className}`}
          style={{ width: size, height: size }}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {(provider as string)?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
      );
  }
};