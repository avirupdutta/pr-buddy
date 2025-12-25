import { useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

export function ApiKeyInput({
  value,
  onChange,
  placeholder,
  icon,
}: ApiKeyInputProps) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="flex w-full items-center rounded-xl border border-input bg-background transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
      <div className="flex h-12 w-12 items-center justify-center text-muted-foreground border-r border-input">
        {icon}
      </div>
      <Input
        type={showValue ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-12 w-12 text-muted-foreground hover:text-foreground"
        onClick={() => setShowValue(!showValue)}
      >
        {showValue ? (
          <IconEyeOff className="w-5 h-5" />
        ) : (
          <IconEye className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
}
