import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES } from "@/lib/accounts/authForms";
import { cn } from "@/lib/utils";

/**
 * Searchable country picker.
 *
 * Every country and territory the platform knows about, filtered as the visitor
 * types, so nobody has to scroll a list of nearly three hundred entries.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  placeholder = "Select your country",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-h-[44px] w-full justify-between border-slate-300 bg-white px-3 text-left font-normal text-slate-900 hover:bg-white hover:text-slate-900",
            !value && "text-slate-400",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] border-slate-300 bg-white p-0 text-slate-900"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="bg-white text-slate-900 [&_[cmdk-input-wrapper]]:border-slate-200">
          <CommandInput
            placeholder="Search countries…"
            className="text-slate-900 placeholder:text-slate-400"
          />
          <CommandList className="max-h-64 bg-white">
            <CommandEmpty className="text-slate-500">No country found.</CommandEmpty>
            <CommandGroup className="bg-white">
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country}
                  value={country}
                  className="text-slate-900 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900"
                  onSelect={() => {
                    onChange(country);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-slate-900",
                      value === country ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {country}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
