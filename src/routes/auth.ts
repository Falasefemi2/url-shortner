import { Hono } from "hono";
import { loginUser, registerUser } from "../services/auth_service";

const app = new Hono();

app.post("/register", async (c) => {
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
        const safeUser = {
            id: user.id,
            email: user.email,
        }
        return c.json(
            {
                message: "Login successful",
                token,
                user: safeUser
            })
    } catch (error: any) {
        return c.json({ message: error.message || "Login failed" }, 401)
    }
})

export default app
