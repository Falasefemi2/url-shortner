import { Context, Hono, MiddlewareHandler, Next } from 'hono'
import { db } from './db';
import { links, users } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import { sign } from "hono/jwt";
import { verify } from "hono/jwt"
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

type AppVariables = {
    user: typeof users.$inferSelect
}

const app = new Hono<{ Variables: AppVariables }>()

interface RegisterPayload {
    email: string;
    password: string;
}

const createUrlSchema = z.object({
    longUrl: z.string().url()
})

app.get('/', (c) => {
    return c.text('Hello Hono!')
})

const checkEmailExits = async (email: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    })
    return !!user
}

const hashPassword = async (password: string) => {
    return await Bun.password.hash(password);
}

const registerUser = async (payload: RegisterPayload) => {
    const { email, password } = payload
    const emailExists = await checkEmailExits(email);
    if (emailExists) throw new Error("Email already in use")

    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
        email,
        passwordHash
    }).returning()
}

const loginUser = async (email: string, password: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    })
    if (!user) throw new Error("invalid credentials")
    const validPassword = await Bun.password.verify(password, user.passwordHash)
    if (!validPassword) throw new Error("Invalid credentials")
    const token = await sign(
        { userId: user.id },
        Bun.env.JWT_SECRET!,
        "HS256"
    )
    return { token, user }
}

const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.split(' ')[1]
    if (!token) return c.json({ message: "Unauthorized" }, 401)

    const payload = await verify(token, Bun.env.JWT_SECRET!, "HS256")
    if (!payload) return c.json({ message: "Unauthorized" }, 401)

    const user = await db.query.users.findFirst({
        where: eq(users.id, payload.userId as string),
    })

    if (!user) return c.json({ message: "User not found" }, 401)

    c.set("user", user)
    await next()
}

app.post('/register', async (c) => {
    try {
        const body = await c.req.json()
        await registerUser(body)
        return c.json({
            message: "Reegisteration successful"
        })
    } catch (error: any) {
        return c.json({ message: error.message || "Registration failed" }, 500)
    }
})

app.post('/login', async (c) => {
    try {
        const { email, password } = await c.req.json()
        const { token, user } = await loginUser(email, password)
        return c.json({ message: "Login successful", token })
    } catch (error: any) {
        return c.json({ message: error.message || "Login failed" }, 401)
    }
})

app.post(
    '/shorten',
    authMiddleware,
    zValidator('json', createUrlSchema),
    async (c) => {
        const user = c.get('user')
        const { longUrl } = c.req.valid('json')

        let shortCode: string
        let result

        for (let i = 0; i < 5; i++) {
            try {
                shortCode = nanoid(7)

                result = await db
                    .insert(links)
                    .values({
                        short_link: shortCode,
                        long_link: longUrl,
                        userId: user.id
                    })
                    .returning()

                break // success
            } catch (err: any) {
                // If duplicate, retry
                if (err.code !== '23505') {
                    throw err
                }
            }
        }

        if (!result) {
            return c.json({ message: 'Could not generate short URL' }, 500)
        }

        const base = new URL(c.req.url).origin

        return c.json({
            message: 'URL shortened',
            data: {
                shortUrl: `${base}/${result[0].short_link}`,
                longUrl: result[0].long_link,
                createdAt: result[0].createdAt
            }
        })
    }
)

app.get('/:code', async (c) => {
    const code = c.req.param('code')

    // 1. Find the link
    const result = await db
        .select()
        .from(links)
        .where(eq(links.short_link, code))

    if (!result.length) {
        return c.json({ message: 'URL not found' }, 404)
    }

    const link = result[0]

    // 2. Handle not found
    if (!link) {
        return c.json({ message: 'URL not found' }, 404)
    }

    // 3. Increment clicks safely (atomic)
    await db
        .update(links)
        .set({
            clicks: sql`${links.clicks} + 1`
        })
        .where(eq(links.id, link.id))

    // 4. Redirect
    return c.redirect(link.long_link, 302)
})

export default app
