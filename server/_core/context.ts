import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { AppSession } from "./session";
import { readSessionToken, verifySession } from "./session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  session: AppSession | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const token = readSessionToken(opts.req.headers.cookie);
  const session = token ? await verifySession(token) : null;

  return {
    req: opts.req,
    res: opts.res,
    user: null,
    session,
  };
}
