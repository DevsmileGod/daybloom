import { HttpError, type PrismaClient } from "wasp/server";
import { hasActiveSubscription } from "./plans";

type UserDelegate = PrismaClient["user"];

/**
 * Runs `work` as a paid AI operation.
 *
 * Users without an active subscription pay one credit per call. The credit is
 * reserved before `work` runs, so users without credits never reach the paid
 * API. The conditional update is atomic, which stops concurrent requests from
 * spending more credits than the user has. If `work` throws, the credit is
 * refunded.
 *
 * @throws HttpError 402 when the user has no subscription and no credits left.
 */
export async function withCreditCharge<T>(
  user: { id: string; subscriptionStatus: string | null },
  userDelegate: UserDelegate,
  work: () => Promise<T>,
): Promise<T> {
  const shouldChargeCredit = !hasActiveSubscription(user);
  if (shouldChargeCredit) {
    const { count: reservedCredits } = await userDelegate.updateMany({
      where: { id: user.id, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    if (reservedCredits === 0) {
      throw new HttpError(402, "User has no subscription and is out of credits");
    }
  }

  try {
    return await work();
  } catch (error) {
    if (shouldChargeCredit) {
      await userDelegate.update({
        where: { id: user.id },
        data: { credits: { increment: 1 } },
      });
    }
    throw error;
  }
}
