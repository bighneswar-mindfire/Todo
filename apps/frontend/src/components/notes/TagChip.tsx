import { textColorFor } from "@/lib/tag-color";

interface TagChipProps {
  name: string;
  color: string;
}

export function TagChip({ name, color }: TagChipProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color, color: textColorFor(color) }}
    >
      {name}
    </span>
  );
}
