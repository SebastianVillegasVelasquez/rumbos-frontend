import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

interface MenuItem {
    label: string;
    icon?: ReactNode;
    onSelect: () => void;
    destructive?: boolean;
}

export const DropdownMenu = ({ trigger, items }: { trigger: ReactNode; items: MenuItem[] }) => (
    <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
        <RadixDropdown.Portal>
            <RadixDropdown.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[10rem] rounded-md bg-surface p-1.5 shadow-soft focus:outline-none"
            >
                {items.map((item) => (
                    <RadixDropdown.Item
                        key={item.label}
                        onSelect={item.onSelect}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium outline-none ${
                            item.destructive ? "text-coral-dark hover:bg-coral-tint" : "text-ink hover:bg-surface-muted"
                        }`}
                    >
                        {item.icon}
                        {item.label}
                    </RadixDropdown.Item>
                ))}
            </RadixDropdown.Content>
        </RadixDropdown.Portal>
    </RadixDropdown.Root>
);
