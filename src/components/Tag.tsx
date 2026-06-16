type TagColor = "sf" | "react" | "ai" | "mkt";

const tagStyles: Record<TagColor, { bg: string; text: string }> = {
  sf: { bg: "bg-sky-light", text: "text-sky-700" },
  react: { bg: "bg-emerald-light", text: "text-emerald-700" },
  ai: { bg: "bg-amber-light", text: "text-amber-700" },
  mkt: { bg: "bg-pink-light", text: "text-pink-700" },
};

interface TagProps {
  label: string;
  color?: TagColor;
}

export function Tag({ label, color = "sf" }: TagProps) {
  const style = tagStyles[color] ?? tagStyles.sf;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      {label}
    </span>
  );
}

// Category pill for blog listing filters
interface PillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Pill({ label, active = false, onClick }: PillProps) {
  return (
    <span
      onClick={onClick}
      className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer no-underline transition-all duration-150 select-none
        ${
          active
            ? "bg-navy text-white"
            : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:border-gray-300"
        }`}
    >
      {label}
    </span>
  );
}
