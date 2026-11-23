import { db, schema } from '../db';
import { eq, and, gt, lt, isNotNull } from 'drizzle-orm';
import { sendSubscriptionReminderNotification } from './notifications';

export async function runSubscriptionReminderCheck(): Promise<number> {
  const now = new Date();
  const maxWindow = new Date(now.getTime() + 16 * 86_400_000);
  const targetDays = [15, 7, 3];

  let remindersSent = 0;

  try {
    const activeSubs = await db
      .select({
        id: schema.subscriptions.id,
        userId: schema.subscriptions.userId,
        packageId: schema.subscriptions.packageId,
        endDate: schema.subscriptions.endDate,
        reminderDaysSent: schema.subscriptions.reminderDaysSent,
      })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, 'active'),
          isNotNull(schema.subscriptions.endDate),
          gt(schema.subscriptions.endDate, now),
          lt(schema.subscriptions.endDate, maxWindow),
        ),
      );

    for (const sub of activeSubs) {
      if (!sub.endDate) continue;

      const diffTime = sub.endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / 86_400_000);

      if (!targetDays.includes(daysLeft)) continue;

      const sentList = sub.reminderDaysSent
        ? sub.reminderDaysSent.split(',').map((s) => s.trim())
        : [];

      if (sentList.includes(String(daysLeft))) continue;

      const [user] = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          phoneNumber: schema.users.phoneNumber,
        })
        .from(schema.users)
        .where(eq(schema.users.id, sub.userId))
        .limit(1);

      if (!user) continue;

      const [pkg] = await db
        .select({ name: schema.packages.name })
        .from(schema.packages)
        .where(eq(schema.packages.id, sub.packageId))
        .limit(1);

      const packageName = pkg?.name || 'Paket Layanan';

      try {
        await sendSubscriptionReminderNotification(user, packageName, sub.endDate, daysLeft);
        remindersSent++;

        const updatedSentList = [...sentList, String(daysLeft)].join(',');
        await db
          .update(schema.subscriptions)
          .set({ reminderDaysSent: updatedSentList })
          .where(eq(schema.subscriptions.id, sub.id));
      } catch (err: any) {
        console.warn(`[SubscriptionReminder] Failed sending for sub ${sub.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`[SubscriptionReminder] Check error:`, err.message);
  }

  return remindersSent;
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function initSubscriptionReminderCron() {
  if (reminderInterval) return;

  // Run on startup after 10 seconds delay
  setTimeout(() => {
    runSubscriptionReminderCheck().catch(() => {});
  }, 10_000);

  // Check every 6 hours
  reminderInterval = setInterval(
    () => {
      runSubscriptionReminderCheck().catch(() => {});
    },
    6 * 60 * 60 * 1000,
  );
}
