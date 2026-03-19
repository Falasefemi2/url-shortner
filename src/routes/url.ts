import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth_middleware";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { nanoid } from "nanoid";
import { db } from "../db";
import { links, users } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";

type AppVariables = {
    user: typeof users.$inferSelect;
};

const app = new Hono<{ Variables: AppVariables }>();

const createUrlSchema = z.object({
    longUrl: z.string().url(),
});

app.post(
    "/shorten",
    authMiddleware,
    zValidator("json", createUrlSchema),
    async (c) => {
        const user = c.get("user");
        const { longUrl } = c.req.valid("json");

        let shortCode: string;
        let result;

        for (let i = 0; i < 5; i++) {
            try {
                shortCode = nanoid(7);

                result = await db
                    .insert(links)
                    .values({
                        short_link: shortCode,
                        long_link: longUrl,
                        userId: user.id,
                    })
                    .returning();

                break; // success
            } catch (err: any) {
                // If duplicate, retry
                if (err.code !== "23505") {
                    throw err;
                }
            }
        }

        if (!result) {
            return c.json({ message: "Could not generate short URL" }, 500);
        }

        const base = new URL(c.req.url).origin;

        return c.json({
            message: "URL shortened",
            data: {
                shortUrl: `${base}/${result[0].short_link}`,
                longUrl: result[0].long_link,
                createdAt: result[0].createdAt,
            },
        });
    },
);

export const redirectToLongUrl = async (c: Context) => {
    const code = c.req.param("code");

    if (!code) {
        return c.json({ message: "URL code is required" }, 400);
    }

    const result = await db
        .select()
        .from(links)
        .where(eq(links.short_link, code));

    if (!result.length) {
        return c.json({ message: "URL not found" }, 404);
    }

    const link = result[0];

    if (!link) {
        return c.json({ message: "URL not found" }, 404);
    }

    await db
        .update(links)
        .set({
            clicks: sql`${links.clicks} + 1`,
        })
        .where(eq(links.id, link.id));

    return c.redirect(link.long_link, 302);
};

app.get("/:code", redirectToLongUrl);

export default app;
