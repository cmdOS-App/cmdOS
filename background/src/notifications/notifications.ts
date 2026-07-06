/**
 * @file notifications.ts
 * @description Manages system OS notifications for the Chrome extension via chrome.notifications API.
 *
 * This module handles the creation of timed notifications and processes
 * notification click events, particularly those related to tasks, reminders,
 * and alarms, by executing the associated actions.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeTodoAction, completeTodoInBg } from '@todos/todos';

/**
 * Creates a system notification that automatically closes after a specified delay.
 *
 * @param id Optional explicit ID for the notification. Generated if null.
 * @param options Chrome notification options (title, message, iconUrl, etc).
 * @param delayMs Auto-close delay in milliseconds (defaults to 5000).
 */
export function createNotification(
  id: string | null,
  options: chrome.notifications.NotificationOptions,
  delayMs: number = 5000,
) {
  const finalId = id || `notif-${Date.now()}`;
  const finalOptions: chrome.notifications.NotificationOptions = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: 'cmdOS Notification',
    message: '',
    ...options,
    requireInteraction: false, // Force auto-close
  };

  chrome.notifications.create(finalId, finalOptions as any, createdId => {
    setTimeout(() => {
      chrome.notifications.clear(createdId);
    }, delayMs);
  });
}

/**
 * Global handler for clicks on system notifications.
 * Automatically parses todo IDs from standard alarm formats and executes the task action
 * while marking it as completed.
 *
 * @param notificationId The ID of the clicked notification.
 */
export function handleNotificationClick(notificationId: string) {
  if (
    notificationId.startsWith('todo-') ||
    notificationId.startsWith('reminder-') ||
    notificationId.startsWith('alarm-') ||
    notificationId.startsWith('immediate-')
  ) {
    // Extract todoId by removing prefix and suffix timestamp
    const firstDash = notificationId.indexOf('-');
    const lastDash = notificationId.lastIndexOf('-');
    const todoId = notificationId.substring(firstDash + 1, lastDash);

    if (todoId) {
      // 1. Execute the task action (Open tab, trigger automation, etc)
      executeTodoAction(todoId);

      // 2. Complete the task logic (Sync cloud, reschedule recurring, clear alarms)
      completeTodoInBg(todoId);

      // 3. Clear the notification after it's clicked
      chrome.notifications.clear(notificationId);
    }
  }
}
