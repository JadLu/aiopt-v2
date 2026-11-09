// Shared (client + server) notification types. No Firebase imports.

export type NotificationType = "plan_ready" | "creatives_ready" | "generation_failed" | "credits_low";

/** A notification as the UI sees it. Stored at users/{uid}/notifications/{id}, written only by the server. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app link opened when the notification is clicked. */
  href?: string;
  read: boolean;
  /** Milliseconds since epoch. */
  createdAt: number;
}

/** Credits-low fires when a charge takes the balance from at/above this to below it. */
export const LOW_CREDITS_THRESHOLD = 50;
