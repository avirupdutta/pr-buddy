import { useEffect, useState } from "react";
import { IconArrowLeft, IconExternalLink, IconFileSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isExtensionContext } from "@/services/dev-mock";

export function ReviewApp() {
  const [prNumber, setPrNumber] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pr = params.get("pr");
    if (pr) {
      setPrNumber(pr);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 flex justify-center overflow-hidden">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[640px] flex flex-col gap-8">
          {/* Header */}
          <header className="flex flex-col gap-4 text-center sm:text-left animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Back button for dev mode or just to close tab */}
            {!isExtensionContext() ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                   window.dispatchEvent(
                    new CustomEvent("dev-navigate", { detail: { path: "/" } })
                  );
                }}
              >
                <IconArrowLeft className="w-4 h-4" />
                Back to Popup
              </Button>
            ) : (
                <Button
                variant="ghost"
                size="sm"
                className="w-fit -ml-2 gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => window.close()}
              >
                <IconArrowLeft className="w-4 h-4" />
                Close Tab
              </Button>
            )}
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <IconFileSearch className="w-7 h-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Review PR {prNumber ? `#${prNumber}` : ""}
              </h1>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-xl">
              This is the new PR review page. You can now analyze and provide feedback on your pull requests more effectively.
            </p>
          </header>

          {/* Content Card */}
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <CardContent className="pt-6 flex flex-col gap-6 min-h-[300px] items-center justify-center text-center">
              <div className="flex flex-col gap-2 items-center">
                 <IconFileSearch className="w-12 h-12 text-muted-foreground/50" />
                 <h2 className="text-xl font-semibold">Review content coming soon</h2>
                 <p className="text-muted-foreground max-w-sm">
                   We are working on bringing full PR review capabilities directly into this screen.
                 </p>
              </div>
              
              <Button variant="outline" className="gap-2" onClick={() => window.open(`https://github.com/`, '_blank')}>
                <IconExternalLink className="w-4 h-4" />
                Open GitHub
              </Button>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              Documentation
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              Support
            </a>
            <span>•</span>
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
