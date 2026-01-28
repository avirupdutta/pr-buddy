import React, { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/provider-logos";
import type { AIModel } from "@/types/chrome";
import type { AIProviderType } from "@/services/ai-provider-registry";
import modelMappings from "@/data/model-mappings.json";
import { cn } from "@/lib/utils";
import { IconCheck, IconSelector } from "@tabler/icons-react";

interface SearchableModelSelectorProps {
  models: AIModel[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  popoverPosition?: "top" | "bottom";
  customModels?: AIModel[]; // User-added custom models to display in "Custom" section
}

interface ModelOption {
  model: AIModel;
  isCustom: boolean;
  provider: string;
  providerName: string;
}

export const SearchableModelSelector: React.FC<
  SearchableModelSelectorProps
> = ({
  value,
  onValueChange,
  placeholder = "Select a model",
  className = "",
  popoverPosition = "bottom",
  customModels = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      if (a === "Custom") return 1;
      if (b === "Custom") return -1;
      return a.localeCompare(b);
    });
  }, [filteredOptions]);

  // Get current selected option
  const selectedOption = useMemo(() => {
    return allModelOptions.find((option) => option.model.id === value);
  }, [allModelOptions, value]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  const handleSelect = (option: ModelOption) => {
    onValueChange(option.model.id);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        className="border-input data-placeholder:text-muted-foreground bg-input/20 dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed transition-colors focus-visible:ring-2 aria-invalid:ring-2 flex h-7 w-full items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:bg-input/40"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption ? (
          <>
            <ProviderLogo
              provider={selectedOption.provider as AIProviderType}
              size={14}
            />
            <span className="text-sm flex-1">{selectedOption.model.name}</span>
            {selectedOption.isCustom && (
              <span className="text-[10px] px-1.5 py-0 font-medium ml-2 bg-blue-500/20 text-blue-400 rounded-full">
                Custom
              </span>
            )}
          </>
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
          } bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-hidden w-68`}
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
          <div className="max-h-48 overflow-y-auto">
            {groupedOptions.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No models found
              </div>
            ) : (
              groupedOptions.map(([providerName, options]) => (
                <div
                  key={providerName}
                  className="border-b border-border last:border-b-0"
                >
                  {/* Provider Header */}
                  <div
                    className={
                      "px-3 py-1.5 bg-muted capitalize text-xs font-medium text-muted-foreground sticky top-0"
                    }
                  >
                    {providerName}
                  </div>

                  {/* Model Options */}
                  {options.map((option) => (
                    <div
                      key={option.model.id}
                      className={`px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-accent transition-colors ${
                        option.model.id === value ? "bg-accent" : ""
                      }`}
                      onClick={() => handleSelect(option)}
                    >
                      <ProviderLogo
                        provider={option.provider as AIProviderType}
                        size={16}
                      />
                      <span
                        className={cn(
                          "text-sm flex-1 text-muted-foreground",
                          option.model.id === value &&
                            "text-foreground font-semibold",
                        )}
                      >
                        {option.model.name}
                      </span>
                      {option.model.id === value && (
                        <IconCheck className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
