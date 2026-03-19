import { relations } from "drizzle-orm"
import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"


export const links = pgTable("links", {
    id: uuid("id").defaultRandom().primaryKey(),
    short_link: text('short_link').unique().notNull(),
    long_link: varchar("long_link").notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
})

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
    links: many(links)
}))

export const linksRelations = relations(links, ({ one }) => ({
    user: one(users, {
        fields: [links.userId],
        references: [users.id]
    })
}))
