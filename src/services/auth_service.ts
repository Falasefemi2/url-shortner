import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { sign } from "hono/jwt";

interface RegisterPayload {
    email: string;
    password: string;
}

export const checkIfEmailExits = async (email: string) => {
    const user = db.query.users.findFirst({
        where: eq(users.email, email)
    })
    return !!user;
}

const hashPassword = async (password: string) => {
    return Bun.password.hash(password);
}

export const registerUser = async (payload: RegisterPayload) => {
    const { email, password } = payload
    const emailExists = await checkIfEmailExits(email)
    if (!emailExists) throw new Error("Email taken already");

    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
        email,
        passwordHash
    }).returning()
}

export const loginUser = async (email: string, password: string) => {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    })
    if (!user) throw new Error("Invalid Credentials")
    const validPassword = await Bun.password.verify(password, user.passwordHash)
    if (!validPassword) throw new Error("invalid Credentials")
    const token = await sign(
        { userId: user.id },
        Bun.env.JWT_SECRET!,
        "HS256"
    )
    return { token, user }
}


