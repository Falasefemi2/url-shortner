import { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { Effect } from "effect"

class MissingToken { readonly _tag = "MissingToken" }
class InvalidToken { readonly _tag = "InvalidToken" }
class UserNotFound { readonly _tag = "UserNotFound" }
class UnexpectedError { readonly _tag = "UnexpectedError" }
class DatabaseError {
    readonly _tag = "DatabaseError"
    constructor(readonly message?: string) { }
}

const getToken = (c: Context): Effect.Effect<string, MissingToken> => {
    const token = c.req.header("Authorization")?.split(' ')[1]
    if (!token) return Effect.fail(new MissingToken())
    return Effect.succeed(token)
}

const runAuth = (c: Context, next: Next) =>
    getToken(c).pipe(
        Effect.flatMap(token => Effect.tryPromise({
            try: () => verify(token, Bun.env.JWT_SECRET!, "HS256"),
            catch: () => new InvalidToken()
        })),
        Effect.flatMap(payload => Effect.tryPromise({
            try: () => db.query.users.findFirst({
                where: eq(users.id, payload.userId as string)
            }),
            catch: () => new DatabaseError()
        })),
        Effect.flatMap(user =>
            user ? Effect.succeed(user) : Effect.fail(new UserNotFound())
        ),
        Effect.flatMap(user => Effect.tryPromise({
            try: async () => {
                c.set("user", user)
                await next()
            },
            catch: () => new UnexpectedError()
        }))
    )

export const authMiddleware = async (c: Context, next: Next) => {
    return Effect.runPromise(
        runAuth(c, next).pipe(
            Effect.match({
                onFailure: (error) => {
                    switch (error._tag) {
                        case "MissingToken":
                        case "InvalidToken":
                            return c.json({ message: "Unauthorized" }, 401)
                        case "UserNotFound":
                            return c.json({ message: "User not found" }, 401)
                        default:
                            return c.json({ message: "Something went wrong" }, 500)
                    }
                },
                onSuccess: () => undefined
            })
        )
    )
}
