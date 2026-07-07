import { SearchTrigger } from "@/components/search/trigger";
import { NotificationBell } from "@/components/notifications/bell";
import { LocaleSwitcher } from "@/components/locale/switcher";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";

type HeaderProps = {
  email: string;
  isAdmin: boolean;
};

export async function Header({ email, isAdmin }: HeaderProps) {
  return (
    <header className="border-b border-border-primary bg-bg-secondary px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MobileNav isAdmin={isAdmin} />
          <SearchTrigger />
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <NotificationBell />
          <div className="relative group">
            <span className="text-sm text-fg-secondary cursor-pointer">{email}</span>
            <div className="absolute right-0 top-full mt-1 w-40 bg-bg-primary border border-border-primary rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
