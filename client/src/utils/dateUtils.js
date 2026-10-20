/**
 * Date utility functions for message grouping and time formatting in KNOT.
 */

/**
 * Checks whether two dates belong to the exact same calendar day
 * in the user's local timezone.
 */
export function isSameCalendarDay(dateA, dateB) {
  if (!dateA || !dateB) return false;
  const d1 = new Date(dateA);
  const d2 = new Date(dateB);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Formats a message timestamp into a date separator label:
 * - "Today" for messages from the current calendar day
 * - "Yesterday" for messages from the preceding calendar day
 * - "D MMMM YYYY" (e.g. "18 October 2026") for earlier dates
 */
export function formatDateSeparator(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  // 1. Check if it's today in user's local timezone
  if (isSameCalendarDay(date, now)) {
    return "Today";
  }

  // 2. Check if it's yesterday in user's local timezone
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }

  // 3. Messages sent earlier: format as "D MMMM YYYY" (e.g. "18 October 2026")
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Formats a conversation timestamp for sidebar previews:
 * - Time (e.g. "10:30 AM") for today
 * - "Yesterday" for yesterday
 * - Weekday (e.g. "Sun") for within the last 7 calendar days
 * - "D MMM" (e.g. "18 Oct") for older
 */
export function formatConversationTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  if (isSameCalendarDay(date, now)) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }

  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffCalendarDays = Math.round((startOfNow - startOfDate) / (1000 * 60 * 60 * 24));

  if (diffCalendarDays < 7 && diffCalendarDays > 0) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Formats the time inside a message bubble (e.g. "10:14 AM")
 */
export function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
