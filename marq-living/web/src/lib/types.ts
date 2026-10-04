import type { Enums, Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type AppRole = Enums<"app_role">;
export type AccountStatus = Enums<"account_status">;
export type Run = Tables<"runs">;
export type Route = Tables<"routes">;
export type Stop = Tables<"stops">;
export type Announcement = Tables<"announcements">;
export type Ticket = Tables<"tickets">;
export type TicketMessage = Tables<"ticket_messages">;
export type Amenity = Tables<"amenities">;
export type Booking = Tables<"bookings">;
export type Notification = Tables<"notifications">;
export type LaundryMachine = Tables<"laundry_machines">;
export type Device = Tables<"devices">;
export type Room = Tables<"rooms">;
export type AutomationRule = Tables<"automation_rules">;
export type EvSession = Tables<"ev_sessions">;
