# lensifyServer

Node.js/Express backend for the **lensify** contact lens app. Handles user auth (JWT) and lens records (**MongoDB** via Mongoose).

## Setup

```bash
cd server
npm install
```

## Run

```bash
npm start
```

Runs at **http://localhost:3000** (or set `PORT` in env).

For auto-restart on file changes:

```bash
npm run dev
```

## Environment

Copy `.env.example` to `.env` and set:

- `PORT` – Server port (default: 3000)
- `JWT_SECRET` – Secret for JWT signing (**required in production**)
- `MONGODB_URI` – MongoDB connection string (e.g. Atlas)
- `CORS_ORIGIN` – `*` for dev, or comma-separated origins in production

## API

### Auth

| Method | Path           | Body                    | Description        |
|--------|----------------|-------------------------|--------------------|
| POST   | `/auth/register` | `{ email, password, name }` | Register; returns `{ user, token }` |
| POST   | `/auth/login`    | `{ email, password }`       | Login; returns `{ user, token }`    |
| GET    | `/auth/me`       | – (header: `Authorization: Bearer <token>`) | Current user |

### Lens records

All require header: `Authorization: Bearer <token>`.

| Method | Path      | Description              |
|--------|-----------|--------------------------|
| GET    | `/lens`   | List current user’s records |
| POST   | `/lens`   | Create record (body: patientName, power, powerType, hvid, diameter, baseCurve, lensType, lensColor, spectaclePower, notes) |
| DELETE | `/lens/:id` | Delete one record       |

### Health

- `GET /health` – Returns `{ ok: true }`

## Database

**MongoDB** – collections managed by Mongoose (`users`, `lensrecords`). Ensure `MONGODB_URI` is set before starting.
