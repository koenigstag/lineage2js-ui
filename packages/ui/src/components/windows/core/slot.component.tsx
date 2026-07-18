export interface SlotContent {
  type: string;
  data: unknown;
}

export interface SlotProps {
  type: "hotbar" | "inventory";
  content?: SlotContent;
}

export function Slot({ content }: SlotProps) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        border: "1px solid #666666",
        backgroundColor: "#1e1e1e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "#999999",
        overflow: "hidden",
      }}
    >
      {content?.type}
    </div>
  );
}
