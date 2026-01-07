import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGeneratorStore } from "@/stores/generator-store";
import { motion, AnimatePresence } from "framer-motion";

export function TitleOptions() {
  const { generateTitle, setGenerateTitle, titleContext, setTitleContext } =
    useGeneratorStore();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label className="text-sm font-medium">Generate PR Title</Label>
          <span className="text-xs text-muted-foreground">
            Auto-generate title based on changes
          </span>
        </div>
        <Switch
          checked={generateTitle}
          onCheckedChange={setGenerateTitle}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      <AnimatePresence>
        {generateTitle && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs font-medium text-muted-foreground">
                  Title Instructions
                </Label>
              </div>
              <Textarea
                value={titleContext}
                onChange={(e) => setTitleContext(e.target.value)}
                placeholder="e.g. Use conventional commits, keep it under 50 chars..."
                className="min-h-[60px] resize-y text-sm h-20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
