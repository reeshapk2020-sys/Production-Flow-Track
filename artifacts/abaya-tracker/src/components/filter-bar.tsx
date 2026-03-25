import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

interface FilterField {
  name: string;
  label: string;
  type: "date" | "select" | "text";
  placeholder?: string;
  options?: { value: string | number; label: string }[];
}

interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function FilterBar({ fields, values, onChange }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasActiveFilters = Object.values(values).some(v => v !== "");

  const handleClear = () => {
    const empty: Record<string, string> = {};
    fields.forEach(f => { empty[f.name] = ""; });
    onChange(empty);
  };

  const handleChange = (name: string, value: string) => {
    onChange({ ...values, [name]: value });
  };

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={`rounded-lg gap-1.5 text-sm ${hasActiveFilters ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
              {Object.values(values).filter(v => v !== "").length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs text-muted-foreground hover:text-red-500 gap-1"
            onClick={handleClear}
          >
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-border">
          {fields.map(field => (
            <div key={field.name}>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{field.label}</label>
              {field.type === "text" ? (
                <input
                  type="text"
                  placeholder={field.placeholder || "Search..."}
                  className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  value={values[field.name] || ""}
                  onChange={e => handleChange(field.name, e.target.value)}
                />
              ) : field.type === "date" ? (
                <input
                  type="date"
                  className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  value={values[field.name] || ""}
                  onChange={e => handleChange(field.name, e.target.value)}
                />
              ) : (
                <select
                  className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card focus:ring-1 focus:ring-primary/30 focus:border-primary outline-none"
                  value={values[field.name] || ""}
                  onChange={e => handleChange(field.name, e.target.value)}
                >
                  <option value="">All</option>
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
