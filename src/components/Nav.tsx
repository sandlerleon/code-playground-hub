import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Terminal, LogOut, User as UserIcon } from "lucide-react";

export function Nav() {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Terminal className="h-5 w-5 text-primary" />
          <span>AI Trainer</span>
        </Link>
        <nav className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm"><UserIcon className="h-4 w-4 mr-2" />My Snippets</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
                <LogOut className="h-4 w-4 mr-2" />Sign out
              </Button>
            </>
          ) : !loading ? (
            <Link to="/auth"><Button size="sm">Sign in</Button></Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
