import React, { useState, useMemo, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderLogo } from "@/components/provider-logos";
import type { AIModel } from "@/types/chrome";
import type { AIProviderType } from "@/services/ai-provider-registry";
import modelMappings from "@/data/model-mappings.json";
import { cn } from "@/lib/utils";
import { IconCheck, IconSelector, IconLock } from "@tabler/icons-react";

interface ModelMappingData {
  id: string;
  name: string;
  modelId: string;
  description: string;
  supportsJsonSchema?: boolean;
  isFree?: boolean;
  pricing?: {
    prompt: string;
    completion: string;
  };
  contextLength?: number;
  reasoningEffort?: string;
}

interface ProviderData {
  name: string;
  models: ModelMappingData[];
  enabled: boolean;
  sortRank: number;
}

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
  onOpen?: () => void; // Callback when dropdown opens
  onClose?: () => void; // Callback when dropdown closes
}

interface ModelOption {
  model: AIModel;
  isCustom: boolean;
  provider: string;
  providerName: string;
  uniqueId: string; // Composite key: provider + model.id to handle duplicate IDs across providers
  fullModelData?: {
    description?: string;
    isFree?: boolean;
    supportsJsonSchema?: boolean;
    pricing?: {
      prompt: string;
      completion: string;
    };
    contextLength?: number;
    reasoningEffort?: string;
  };
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
  onOpen,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoveredModel, setHoveredModel] = useState<ModelOption | null>(null);
  const [isDetailsPanelHovered, setIsDetailsPanelHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOptionRef = useRef<HTMLDivElement>(null);

  // Convert predefined models from JSON to ModelOption format
  // Filter out disabled providers and sort by sortRank
  const predefinedModelOptions: ModelOption[] = useMemo(() => {
    const options: ModelOption[] = [];

    // Get enabled providers and sort by sortRank
    const enabledProviders = Object.entries(modelMappings.providers)
      .filter(([, providerData]) => (providerData as ProviderData).enabled)
      .sort(
        ([, a], [, b]) =>
          (a as ProviderData).sortRank - (b as ProviderData).sortRank,
      );

    enabledProviders.forEach(([providerId, providerData]) => {
      (providerData as ProviderData).models.forEach(
        (model: ModelMappingData) => {
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
            providerName: (providerData as ProviderData).name,
            uniqueId: `${providerId}:${model.id}`, // Composite key for unique identification
            fullModelData: {
              description: model.description,
              isFree: model.isFree,
              supportsJsonSchema: model.supportsJsonSchema,
              pricing: model.pricing,
              contextLength: model.contextLength,
              reasoningEffort: model.reasoningEffort,
            },
          });
        },
      );
    });
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

      // Get provider IDs and sortRank for comparison
      const getProviderData = (
        providerName: string,
      ): { id: string; sortRank: number } => {
        const entry = Object.entries(modelMappings.providers).find(
          ([, data]) => (data as ProviderData).name === providerName,
        );
        return entry
          ? { id: entry[0], sortRank: (entry[1] as ProviderData).sortRank }
          : { id: providerName, sortRank: 0 };
      };

      const providerA = getProviderData(a);
      const providerB = getProviderData(b);

      // First sort by sortRank
      if (providerA.sortRank !== providerB.sortRank) {
        return providerA.sortRank - providerB.sortRank;
      }

      // Then sort providers with API keys first
      const hasKeyA =
        providerKeyStatus[providerA.id as AIProviderType] ?? false;
      const hasKeyB =
        providerKeyStatus[providerB.id as AIProviderType] ?? false;

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

  // Determine which model to show in details panel:
  // 1. If details panel is hovered, keep showing the last hovered model
  // 2. If a model is hovered, show that model
  // 3. Otherwise, show the selected model
  const modelToShow = useMemo(() => {
    if (isDetailsPanelHovered && hoveredModel) {
      return hoveredModel;
    }
    if (hoveredModel) {
      return hoveredModel;
    }
    return selectedOption;
  }, [isDetailsPanelHovered, hoveredModel, selectedOption]);

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
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

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
    onClose?.();
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
        onClick={() => {
          if (!disabled) {
            const newIsOpen = !isOpen;
            setIsOpen(newIsOpen);
            if (newIsOpen) {
              onOpen?.();
            } else {
              onClose?.();
            }
          }
        }}
      >
        {selectedOption ? (
          <div className="flex items-center gap-2 max-w-[150px]">
            <ProviderLogo
              provider={selectedOption.provider as AIProviderType}
              size={12}
            />
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
          className={cn(
            "absolute left-0 right-0 z-50 shadow-md bg-background/95 backdrop-blur-md border border-border rounded-md max-h-80 overflow-hidden w-[432px]",
            popoverPosition === "top"
              ? "bottom-full mb-1 animate-dropdown-fade-up-top"
              : "top-full mt-1 animate-dropdown-fade-up",
          )}
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

          {/* Two-column layout */}
          <div className="flex h-68">
            {/* Options Column */}
            <ScrollArea
              viewportRef={scrollAreaRef}
              onScroll={handleScroll}
              classNames={{
                root: "h-full w-[220px] max-w-[220px] border-r border-border",
              }}
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
                  ).find(
                    ([, data]) => (data as ProviderData).name === providerName,
                  );
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
                            hoveredModel?.uniqueId === option.uniqueId &&
                              !isLocked
                              ? "bg-accent/50"
                              : "",
                          )}
                          onClick={() => !isLocked && handleSelect(option)}
                          onMouseEnter={() =>
                            !isLocked && setHoveredModel(option)
                          }
                          onMouseLeave={() => {
                            // Don't clear hoveredModel if details panel is being hovered
                            if (!isDetailsPanelHovered) {
                              setHoveredModel(null);
                            }
                          }}
                        >
                          <ProviderLogo
                            provider={option.provider as AIProviderType}
                            size={12}
                          />
                          <span
                            className={cn(
                              "text-xs flex-1 truncate",
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

            {/* Details Panel Column */}
            <ScrollArea
              classNames={{ root: "flex-1 bg-muted/30" }}
              onMouseEnter={() => setIsDetailsPanelHovered(true)}
              onMouseLeave={() => setIsDetailsPanelHovered(false)}
            >
              <div className="p-4">
                {modelToShow ? (
                  <div className="space-y-4">
                    {/* Model Name */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">
                        {modelToShow.model.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <ProviderLogo
                          provider={modelToShow.provider as AIProviderType}
                          size={14}
                        />
                        <span className="text-xs text-muted-foreground">
                          {modelToShow.providerName}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    {modelToShow.fullModelData?.description && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Description
                        </h4>
                        <p className="text-xs text-foreground leading-relaxed">
                          {modelToShow.fullModelData.description}
                        </p>
                      </div>
                    )}

                    {/* Features */}
                    <div className="space-y-2">
                      {modelToShow.fullModelData?.isFree !== undefined && (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full",
                              modelToShow.fullModelData.isFree
                                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {modelToShow.fullModelData.isFree ? "Free" : "Paid"}
                          </span>
                        </div>
                      )}

                      {modelToShow.fullModelData?.supportsJsonSchema !==
                        undefined && (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full",
                              modelToShow.fullModelData.supportsJsonSchema
                                ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {modelToShow.fullModelData.supportsJsonSchema
                              ? "JSON Schema"
                              : "No JSON Schema"}
                          </span>
                        </div>
                      )}

                      {modelToShow.fullModelData?.reasoningEffort && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400">
                            {modelToShow.fullModelData.reasoningEffort}{" "}
                            reasoning
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pricing */}
                    {modelToShow.fullModelData?.pricing && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">
                          Pricing
                        </h4>
                        <div className="space-y-1">
                          <div className="flex gap-1.5 text-xs">
                            <span className="text-muted-foreground">
                              Input:
                            </span>
                            <span className="text-foreground">
                              ${modelToShow.fullModelData.pricing.prompt} / M
                            </span>
                          </div>
                          <div className="flex gap-1.5 text-xs">
                            <span className="text-muted-foreground">
                              Output:
                            </span>
                            <span className="text-foreground">
                              ${modelToShow.fullModelData.pricing.completion} /
                              M
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Context Length */}
                    {modelToShow.fullModelData?.contextLength && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Context Length
                        </h4>
                        <p className="text-xs text-foreground">
                          {modelToShow.fullModelData.contextLength.toLocaleString()}{" "}
                          tokens
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <IconLock className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Select a model to see details
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};
