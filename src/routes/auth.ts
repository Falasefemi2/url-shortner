import { Hono } from "hono";
import { loginUser, registerUser } from "../services/auth_service";
import { Effect } from "effect"

const app = new Hono();

app.post("/register", async (c) => {
    const body = await c.req.json()

    return Effect.runPromise(
        registerUser(body).pipe(
            Effect.match({
                onFailure: (error) => {
                    switch (error._tag) {
                        case "EmailAlreadyExistsError":
                            return c.json({ message: "Email already taken" }, 400)
                        case "DatabaseError":
                            return c.json({ message: "Something went wrong" }, 500)
                        default:
                            return c.json({ message: "Registration failed" }, 500)
                    }
                },
                onSuccess: () => c.json({ message: "Registration successful" })
            })
        )
    )
})

app.post("/login", async (c) => {
    const { email, password } = await c.req.json()

    return Effect.runPromise(
        loginUser(email, password).pipe(
            Effect.match({
                onFailure: (error) => {
                    switch (error._tag) {
                        case "UserNotFound":
                            return c.json({ message: "Invalid credentials" }, 401)
                        case "InvalidPassword":
                            return c.json({ message: "Invalid credentials" }, 401)
                        case "DatabaseError":
                            return c.json({ message: "Something went wrong" }, 500)
                        default:
                            return c.json({ message: "Login failed" }, 500)
                    }
                },
                onSuccess: ({ token, user }) =>
                    c.json({
                        message: "Login successful",
                        token,
                        user: { id: user.id, email: user.email }
                    })
            })
        )
    )
})

export default app
