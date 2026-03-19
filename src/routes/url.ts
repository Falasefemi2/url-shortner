import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth_middleware";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { nanoid } from "nanoid";
import { db } from "../db";
import { links, users } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { Effect } from "effect";

class DuplicateShortCode { readonly _tag = "DuplicateShortCode" }
class LinkNotFound { readonly _tag = "LinkNotFound" }
class DatabaseError {
    readonly _tag = "DatabaseError"
    constructor(readonly message?: string) { }
}

type AppVariables = {
    user: typeof users.$inferSelect;
};

const app = new Hono<{ Variables: AppVariables }>();

const createUrlSchema = z.object({
    longUrl: z.string().url(),
});


const insertShortLink = (longUrl: string, userId: string) =>
    Effect.tryPromise({
        try: () =>
            db.insert(links).values({
                short_link: nanoid(7),
                long_link: longUrl,
                userId,
            }).returning(),
        catch: (err: any) =>
            err.code === "23505"
                ? new DuplicateShortCode()
                : new DatabaseError(String(err))
    })

const findLink = (code: string) =>
    Effect.tryPromise({
        try: () =>
            db.select().from(links).where(eq(links.short_link, code)),
        catch: (err) => new DatabaseError(String(err))
    }).pipe(
        Effect.flatMap((result) =>
            result[0] ? Effect.succeed(result[0]) : Effect.fail(new LinkNotFound())
        )
    )

const incrementClicks = (linkId: string) =>
    Effect.tryPromise({
        try: () =>
            db.update(links)
                .set({ clicks: sql`${links.clicks} + 1` })
                .where(eq(links.id, linkId)),
        catch: (err) => new DatabaseError(String(err))
    })

app.post(
    "/shorten",
    authMiddleware,
    zValidator("json", createUrlSchema),
    async (c) => {
        const user = c.get("user")
        const { longUrl } = c.req.valid("json")

        return Effect.runPromise(
            insertShortLink(longUrl, user.id).pipe(
                Effect.retry({ times: 5 }),
                Effect.match({
                    onFailure: (error) => {
                        switch (error._tag) {
                            case "DuplicateShortCode":
                                return c.json({ message: "Could not generate short URL" }, 500)
                            case "DatabaseError":
                                return c.json({ message: "Something went wrong" }, 500)
                        }
                    },
                    onSuccess: (result) => {
                        const base = new URL(c.req.url).origin
                        return c.json({
                            message: "URL shortened",
                            data: {
                                shortUrl: `${base}/${result[0].short_link}`,
                                longUrl: result[0].long_link,
                                createdAt: result[0].createdAt,
                            }
                        })
                    }
                })
            )
        )
    }
)

export const redirectToLongUrl = async (c: Context) => {
    const code = c.req.param("code")
    if (!code) return c.json({ message: "URL code is required" }, 400)

    return Effect.runPromise(
        findLink(code).pipe(
            Effect.flatMap((link) =>
                incrementClicks(link.id).pipe(
                    Effect.map(() => link)
                )
            ),
            Effect.match({
                onFailure: (error) => {
                    switch (error._tag) {
                        case "LinkNotFound":
                            return c.json({ message: "URL not found" }, 404)
                        case "DatabaseError":
                            return c.json({ message: "Something went wrong" }, 500)
                    }
                },
                onSuccess: (link) => c.redirect(link.long_link, 302)
            })
        )
    )
}

app.get("/:code", redirectToLongUrl)

export default app
