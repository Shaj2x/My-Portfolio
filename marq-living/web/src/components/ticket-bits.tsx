import { Badge } from "@/components/ui";

export const TICKET_CATEGORY: Record<string, string> = {
  maintenance: "Maintenance", noise: "Noise", package: "Package", lockout: "Lockout",
  amenity: "Amenity", shuttle: "Shuttle", device_fault: "Device fault", other: "Other",
};

export function TicketStatus({ status }: { status: string }) {
  return status === "resolved" ? <Badge tone="ok">Resolved</Badge> : status === "in_progress" ? <Badge tone="warn">In progress</Badge> : <Badge>Open</Badge>;
}
