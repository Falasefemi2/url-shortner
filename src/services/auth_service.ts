import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { sign } from "hono/jwt";
import { Effect } from "effect"

class EmailAlreadyExistsError {
    readonly _tag = "EmailAlreadyExistsError"
    constructor(readonly email: string) { }
}

class DatabaseError {
    readonly _tag = "DatabaseError"
    constructor(readonly message: string) { }
}

class HashingError {
    readonly _tag = "HashingError"
    constructor(readonly message: string) { }
}

class UserNotFound {
    readonly _tag = "UserNotFound"
    constructor(readonly message?: string) { }
}

class InvalidPassword {
    readonly _tag = "InvalidPassword"
    constructor(readonly message?: string) { }
}

class UnexpectedError {
    readonly _tag = "UnexpectedError"
    constructor(readonly message?: string) { }
}

interface RegisterPayload {
    email: string;
    password: string;
}


const checkIfEmailExits = (email: string) =>
    Effect.tryPromise({
        try: async () => {
            const existing = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1)
            return existing
        },
        catch: (err) => new DatabaseError(String(err))
    }).pipe(
        Effect.flatMap((existing) =>
            existing.length > 0
                ? Effect.fail(new EmailAlreadyExistsError(email))
                : Effect.succeed(void 0)
        )
    )

const hashPassword = (password: string) =>
    Effect.tryPromise({
        try: () => Bun.password.hash(password),
        catch: (err) => new HashingError(String(err))
    })

export const registerUser = (payload: RegisterPayload) =>
    checkIfEmailExits(payload.email).pipe(
        Effect.flatMap(() => hashPassword(payload.password)),
        Effect.flatMap((hash) =>
            Effect.tryPromise({
                try: () =>
                    db.insert(users).values({
                        email: payload.email,
                        passwordHash: hash
                    }).returning(),
                catch: (err) => new DatabaseError(String(err))
            })
        ),
        Effect.map((rows) => rows[0])
    )

const findUserByEmail = (email: string) =>
    Effect.tryPromise({
        try: async () => {
            const user = await db.query.users.findFirst({
                where: eq(users.email, email)
            })
            return user
        },
        catch: (err) => new DatabaseError(String(err))
    }).pipe(
        Effect.flatMap(user =>
            user ? Effect.succeed(user) : Effect.fail(new UserNotFound())
        )
    )

export const loginUser = (email: string, password: string) =>
    findUserByEmail(email).pipe(
        Effect.flatMap((user) =>
            Effect.tryPromise({
                try: () => Bun.password.verify(password, user.passwordHash),
                catch: () => new InvalidPassword()
            }).pipe(
                Effect.flatMap((isValid) =>
                    isValid ? Effect.succeed(user) : Effect.fail(new InvalidPassword())
                )
            )
        ),
        Effect.flatMap((user) =>
            Effect.tryPromise({
                try: () => sign({ userId: user.id }, Bun.env.JWT_SECRET!, "HS256"),
                catch: () => new UnexpectedError()
            }).pipe(
                Effect.map((token) => ({ token, user }))
            )
        )
    )














































































