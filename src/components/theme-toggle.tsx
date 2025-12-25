import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import { useSettingsStore } from "@/stores/settings-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ThemeToggle({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  const { theme, setTheme } = useSettingsStore();

  return (
    <Tabs
      value={theme}
      onValueChange={(value) => setTheme(value as "dark" | "light" | "system")}
      className="w-fit"
    >
      <TabsList className="bg-muted/50 border border-border/50 rounded-full p-0.5 h-auto">
        <TabsTrigger
          value="light"
          className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 gap-2"
        >
          <IconSun className="h-4 w-4" />
          {variant === "full" && <span className="text-xs">Light</span>}
        </TabsTrigger>
        <TabsTrigger
          value="dark"
          className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 gap-2"
        >
          <IconMoon className="h-4 w-4" />
          {variant === "full" && <span className="text-xs">Dark</span>}
        </TabsTrigger>
        <TabsTrigger
          value="system"
          className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 py-1.5 gap-2"
        >
          <IconDeviceDesktop className="h-4 w-4" />
          {variant === "full" && <span className="text-xs">System</span>}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
