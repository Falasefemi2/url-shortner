import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

export const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization")

    const token = authHeader?.split(' ')[1]
    if (!token) return c.json({ message: "UnAuthorization" }, 401)

    const payload = await verify(token, Bun.env.JWT_SECRET!, "HS256")
    if (!payload) return c.json({ message: "Unauthorized" }, 401)

    const user = await db.query.users.findFirst({
        where: eq(users.id, payload.userId as string),
    })

    if (!user) return c.json({ message: "User not found" }, 401)

    c.set("user", user)
    await next()
}
