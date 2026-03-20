# URL Shortener Hono

A high-performance URL shortener service built with Bun, Hono, and Drizzle ORM. This project utilizes functional programming patterns with the Effect library for robust error handling and type safety.

## Tech Stack

- Runtime: Bun
- Framework: Hono
- Database: PostgreSQL
- ORM: Drizzle ORM
- Validation: Zod
- Functional Logic: Effect
- ID Generation: Nanoid

## Features

- User authentication using JWT
- Secure URL shortening for authenticated users
- High-collision-resistant short codes (Nanoid)
- Redirect service with click tracking
- Automated database migrations with Drizzle Kit
- Type-safe API with Zod validation

## Prerequisites

- Bun runtime
- PostgreSQL database instance

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Falasefemi2/url-shortner
cd url-shortener
```

### 2. Install dependencies

```bash
bun install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and provide the following variables:

```env
DATABASE_URL=postgres://user:password@localhost:5432/dbname
JWT_SECRET=your_super_secret_key
```

### 4. Database Setup

Push the schema to your database:

```bash
bun run db:push
```

Or generate and run migrations:

```bash
bun run db:generate
bun run db:migrate
```

### 5. Running the Application

Start the development server with hot reload:

```bash
bun run dev
```

The server will be available at `http://localhost:3000`.

## API Documentation

### Authentication

- POST /auth/register: Register a new user account.
- POST /auth/login: Authenticate and receive a JWT token.

### URL Management

- POST /url/shorten: Create a short URL from a long URL (Requires Authorization header).
  - Header: `Authorization: Bearer <token>`
  - Body: `{ "longUrl": "https://example.com" }`

### Redirection

- GET /:code: Redirect to the original long URL and increment the click counter.

## Development Scripts

- `bun run dev`: Starts the development server.
- `bun run db:push`: Synchronizes the Drizzle schema with the database.
- `bun run db:generate`: Generates migration files.
- `bun run db:migrate`: Applies migrations to the database.
- `bun run db:studio`: Opens Drizzle Studio for database management.

## License

MIT
