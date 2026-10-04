import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">Page introuvable</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground/80">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link to="/" className="mt-8 inline-block">
          <Button>
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;