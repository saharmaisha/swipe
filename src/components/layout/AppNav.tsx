'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sparkles, LayoutGrid, Settings, LogOut, Menu, Heart, MessageSquare, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useTour, type TourPage } from '@/components/tour/TourProvider';

const navLinks = [
  { href: '/boards', label: 'Boards', icon: LayoutGrid },
  { href: '/saved', label: 'Saved', icon: Heart },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function getTourPageFromPath(pathname: string): TourPage | null {
  if (pathname === '/boards') return 'boards';
  if (pathname.startsWith('/boards/')) return 'boardDetail';
  if (pathname.startsWith('/pins/')) return 'pinDetail';
  if (pathname.startsWith('/results/')) return 'results';
  if (pathname === '/saved') return 'saved';
  if (pathname === '/settings') return 'settings';
  return null;
}

export function AppNav({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL;
  const { startTour } = useTour();
  const currentTourPage = getTourPageFromPath(pathname);

  const handleStartTour = () => {
    if (currentTourPage) {
      startTour(currentTourPage);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = email
    ? email.slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Veri</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={pathname.startsWith(link.href) ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2 text-sm"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {currentTourPage && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleStartTour}
              className="text-muted-foreground hover:text-foreground"
              title="Show tour"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
          {feedbackUrl ? (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex"
            >
              <Button variant="ghost" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Feedback
              </Button>
            </a>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden md:flex items-center justify-center h-9 w-9 rounded-full hover:bg-accent cursor-pointer transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 text-sm text-muted-foreground truncate">{email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent cursor-pointer transition-colors">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 pt-10">
              {email && (
                <p className="px-1 pb-4 text-sm text-muted-foreground truncate border-b mb-2">
                  {email}
                </p>
              )}
              <nav className="flex flex-col gap-1 mt-4">
                {feedbackUrl ? (
                  <a href={feedbackUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Feedback
                    </Button>
                  </a>
                ) : null}
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                    <Button
                      variant={pathname.startsWith(link.href) ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-2"
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Button>
                  </Link>
                ))}
                <div className="border-t mt-2 pt-2">
                  <Button variant="ghost" className="w-full justify-start gap-2 text-destructive" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
