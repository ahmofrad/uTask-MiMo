import { SearchTrigger } from "@/components/search/trigger";
import { NotificationBell } from "@/components/notifications/bell";
import { LocaleSwitcher } from "@/components/locale/switcher";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UserMenu } from "@/components/shell/user-menu";

type HeaderProps = {
  email: string;
  name: string;
  isAdmin: boolean;
};

export async function Header({ email, name, isAdmin }: HeaderProps) {
  return (
    <header className="border-b border-border bg-bg-secondary px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MobileNav isAdmin={isAdmin} />
          <SearchTrigger />
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <NotificationBell />
          <UserMenu name={name} email={email} />
        </div>
      </div>
    </header>
  );
}
