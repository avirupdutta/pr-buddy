import React, { useState, useMemo, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderLogo } from "@/components/provider-logos";
import type { AIModel } from "@/types/chrome";
import type { AIProviderType } from "@/services/ai-provider-registry";
import modelMappings from "@/data/model-mappings.json";
import { cn } from "@/lib/utils";
import { IconCheck, IconSelector, IconLock } from "@tabler/icons-react";

interface SearchableModelSelectorProps {
  models: AIModel[];
  value: string;
  activeProvider?: string; // Provider of the currently selected model
  onValueChange: (value: string, provider?: string) => void;
  placeholder?: string;
  className?: string;
  popoverPosition?: "top" | "bottom";
  customModels?: AIModel[]; // User-added custom models to display in "Custom" section
  providerKeyStatus?: Record<AIProviderType, boolean>; // Map of provider to API key status
  disabled?: boolean; // Disable the selector during generation
}

interface ModelOption {
  model: AIModel;
  isCustom: boolean;
  provider: string;
  providerName: string;
  uniqueId: string; // Composite key: provider + model.id to handle duplicate IDs across providers
}

export const SearchableModelSelector: React.FC<
  SearchableModelSelectorProps
> = ({
  value,
  activeProvider,
  onValueChange,
  placeholder = "Select a model",
  className = "",
  popoverPosition = "bottom",
  customModels = [],
  providerKeyStatus = {} as Record<AIProviderType, boolean>,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOptionRef = useRef<HTMLDivElement>(null);

  // Convert predefined models from JSON to ModelOption format
  const predefinedModelOptions: ModelOption[] = useMemo(() => {
    const options: ModelOption[] = [];
    Object.entries(modelMappings.providers).forEach(
      ([providerId, providerData]) => {
        providerData.models.forEach((model) => {
          options.push({
            model: {
              id: model.id,
              name: model.name,
              modelId: model.modelId,
              provider: providerId,
              isActive: false,
            },
            isCustom: false,
            provider: providerId,
            providerName: providerData.name,
            uniqueId: `${providerId}:${model.id}`, // Composite key for unique identification
          });
        });
      },
    );
    return options;
  }, []);

  // Convert custom models to ModelOption format (always marked as custom)
  const customModelOptions: ModelOption[] = useMemo(() => {
    return customModels.map((model) => ({
      model,
      isCustom: true,
      provider: model.provider || "openrouter",
      providerName: "Custom",
      uniqueId: `custom:${model.id}`, // Custom models use 'custom' prefix for unique identification
    }));
  }, [customModels]);

  // Combine all models: predefined + custom
  const allModelOptions: ModelOption[] = useMemo(() => {
    // Create a set of custom model IDs to filter out from predefined
    const customModelIds = new Set(customModels.map((m) => m.id));

    // Filter out predefined models that have the same ID as a custom model
    const filteredPredefined = predefinedModelOptions.filter(
      (option) => !customModelIds.has(option.model.id),
    );

    return [...filteredPredefined, ...customModelOptions];
  }, [predefinedModelOptions, customModelOptions, customModels]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return allModelOptions;
    }

    const query = searchQuery.toLowerCase();
    return allModelOptions.filter(
      (option) =>
        option.model.name.toLowerCase().includes(query) ||
        option.providerName.toLowerCase().includes(query) ||
        option.provider.toLowerCase().includes(query),
    );
  }, [allModelOptions, searchQuery]);

  // Group filtered options by provider
  const groupedOptions = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();

    filteredOptions.forEach((option) => {
      const key = option.providerName;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(option);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => {
      // Sort "Custom" to the end
      if (a === "Custom") return -1;
      if (b === "Custom") return 1;

      // Get provider IDs for comparison
      const getProviderId = (providerName: string): string => {
        const entry = Object.entries(modelMappings.providers).find(
          ([, data]) => data.name === providerName,
        );
        return entry ? entry[0] : providerName;
      };

      const providerA = getProviderId(a);
      const providerB = getProviderId(b);

      // Sort providers with API keys first
      const hasKeyA = providerKeyStatus[providerA as AIProviderType] ?? false;
      const hasKeyB = providerKeyStatus[providerB as AIProviderType] ?? false;

      if (hasKeyA && !hasKeyB) return -1;
      if (!hasKeyA && hasKeyB) return 1;

      return a.localeCompare(b);
    });
  }, [filteredOptions, providerKeyStatus]);

  // Get current selected option - match by both ID and provider
  const selectedOption = useMemo(() => {
    return allModelOptions.find(
      (option) =>
        option.model.id === value &&
        (!activeProvider || option.provider === activeProvider),
    );
  }, [allModelOptions, value, activeProvider]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // Save scroll position before closing
        if (scrollAreaRef.current) {
          setScrollPosition(scrollAreaRef.current.scrollTop);
        }
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Restore scroll position when dropdown opens
  React.useEffect(() => {
    if (isOpen && scrollAreaRef.current) {
      // Use multiple requestAnimationFrame calls to ensure the DOM is fully ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollPosition;
          }
        });
      });
    }
  }, [isOpen, scrollPosition]);

  // Scroll to selected option when popover opens
  React.useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Check if selected option is in the filtered results
          const isSelectedInFiltered = selectedOption
            ? filteredOptions.some(
                (option) => option.uniqueId === selectedOption.uniqueId,
              )
            : false;

          if (isSelectedInFiltered && selectedOptionRef.current) {
            // Scroll to the selected option with smooth behavior
            selectedOptionRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else if (scrollAreaRef.current) {
            // If selected option is not in filtered results or no selection, scroll to top
            scrollAreaRef.current.scrollTop = 0;
          }
        });
      });
    }
  }, [isOpen, selectedOption, filteredOptions]);

  // Handle scroll position change with debounce
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      const target = e.currentTarget;
      if (target) {
        setScrollPosition(target.scrollTop);
      }
    }, 100);
  }, []);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleSelect = (option: ModelOption) => {
    onValueChange(option.model.id, option.provider);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        className={cn(
          "border-input data-placeholder:text-muted-foreground bg-input/20 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed transition-colors focus-visible:ring-2 aria-invalid:ring-2 flex h-7 w-full items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 max-w-[200px]",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-input/40 dark:hover:bg-input/50",
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {selectedOption ? (
          <div className="flex items-center gap-3 max-w-[150px]">
            <span className="text-xs flex-1 truncate">
              {selectedOption.model.name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
        <IconSelector className="text-muted-foreground size-3.5 pointer-events-none shrink-0" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 ${
            popoverPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } bg-background/95 backdrop-blur-md border border-border rounded-md shadow-lg max-h-60 overflow-hidden w-80`}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search models or providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Options */}
          <ScrollArea
            viewportRef={scrollAreaRef}
            onScroll={handleScroll}
            classNames={{ root: "h-48" }}
          >
            {groupedOptions.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No models found
              </div>
            ) : (
              groupedOptions.map(([providerName, options]) => {
                // Get provider ID from provider name
                const providerEntry = Object.entries(
                  modelMappings.providers,
                ).find(([, data]) => data.name === providerName);
                const providerId = providerEntry
                  ? providerEntry[0]
                  : providerName;
                const hasApiKey =
                  providerKeyStatus[providerId as AIProviderType] ?? false;
                const isLocked = providerName !== "Custom" && !hasApiKey;

                return (
                  <div
                    key={providerName}
                    className="border-b border-border last:border-b-0"
                  >
                    {/* Provider Header */}
                    <div
                      className={
                        "px-3 py-1.5 bg-background/80 backdrop-blur-sm capitalize text-xs font-medium text-muted-foreground sticky top-0 flex items-center justify-between"
                      }
                    >
                      <span>{providerName}</span>
                      {isLocked && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-destructive/20 text-destructive rounded-full">
                          API key required
                        </span>
                      )}
                    </div>

                    {/* Model Options */}
                    {options.map((option) => (
                      <div
                        key={option.uniqueId}
                        ref={
                          option.uniqueId === selectedOption?.uniqueId
                            ? selectedOptionRef
                            : null
                        }
                        className={cn(
                          "px-3 py-2 flex items-center gap-2 transition-colors",
                          isLocked
                            ? "cursor-not-allowed"
                            : "cursor-pointer hover:bg-accent",
                          option.uniqueId === selectedOption?.uniqueId &&
                            !isLocked
                            ? "bg-accent"
                            : "",
                        )}
                        onClick={() => !isLocked && handleSelect(option)}
                      >
                        <ProviderLogo
                          provider={option.provider as AIProviderType}
                          size={12}
                        />
                        <span
                          className={cn(
                            "text-xs flex-1",
                            isLocked
                              ? "text-muted-foreground/50"
                              : "text-muted-foreground",
                            option.uniqueId === selectedOption?.uniqueId &&
                              !isLocked &&
                              "text-foreground font-medium",
                          )}
                        >
                          {option.model.name}
                        </span>
                        {option.uniqueId === selectedOption?.uniqueId &&
                          !isLocked && (
                            <IconCheck className="w-4 h-4 text-green-500" />
                          )}
                        {isLocked && (
                          <IconLock className="w-3.5 h-3.5 text-muted-foreground/40" />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
