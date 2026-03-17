# Amarktai Network

**The AI Ecosystem** — A cinematic, premium technology platform built with Next.js 15, TypeScript, Tailwind CSS, and Framer Motion.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS |
| Animation | Framer Motion |
| Database ORM | Prisma |
| Database | PostgreSQL |
| Auth | iron-session + bcryptjs |
| UI Components | Lucide React, Recharts |
| Runtime | Node.js 20+ |

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@host:5432/amarktai_network"
SESSION_SECRET="your-super-secret-session-key-min-32-chars-long"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set Up Database

```bash
# Push schema to database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Bootstrap Admin User

```bash
# Create initial admin account via Prisma seed or direct DB
npx ts-node prisma/seed.ts
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build
npm run start
```

---

## Project Structure

```
amarktai-network/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # DB seed script
├── src/
│   ├── app/
│   │   ├── (pages)/        # Public pages
│   │   ├── admin/          # Admin dashboard + login
│   │   ├── api/            # API routes
│   │   ├── globals.css     # Global styles + design tokens
│   │   └── layout.tsx      # Root layout
│   ├── components/
│   │   ├── layout/         # Header, Footer
│   │   └── ui/             # Reusable UI components
│   ├── lib/
│   │   ├── auth.ts         # Admin auth helpers
│   │   ├── prisma.ts       # Prisma client singleton
│   │   ├── session.ts      # iron-session config
│   │   └── utils.ts        # Utilities
│   └── middleware.ts       # Route protection
├── .env.example
├── deploy.sh               # Production deploy script
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Site Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/about` | Company story & values |
| `/apps` | Ecosystem showcase |
| `/contact` | Contact + waitlist forms |
| `/admin/login` | Admin gateway (hidden) |
| `/admin/dashboard` | Main overview |
| `/admin/dashboard/products` | Manage products |
| `/admin/dashboard/api-keys` | API key management |
| `/admin/dashboard/integrations` | App integrations |
| `/admin/dashboard/vps` | VPS monitoring |
| `/admin/dashboard/contacts` | Contact submissions |
| `/admin/dashboard/waitlist` | Waitlist entries |

---

## Hidden Admin Discovery Flow

The public site includes a **hidden admin reveal interaction**.

To discover the admin access path:
1. Navigate to any public page (Home, About, Apps, Contact)
2. Type `show admin` anywhere (not in a form input)
3. A reveal notification appears in the UI
4. Click "Proceed to secure login" or click the Admin link in the nav

This triggers the admin login page at `/admin/login`.

**Security note:** The admin login is password-gated via server-side session authentication. No secrets are exposed in frontend code.

---

## VPS Deployment

### Prerequisites

- Ubuntu 22.04+ VPS
- Node.js 20+
- PostgreSQL 15+
- PM2 (`npm install -g pm2`)
- Nginx

### Deploy Steps

```bash
# 1. Clone repo
git clone https://github.com/your-org/amarktai-network /var/www/amarktai-network
cd /var/www/amarktai-network

# 2. Set environment
cp .env.example .env
nano .env  # fill in DATABASE_URL, SESSION_SECRET, NEXT_PUBLIC_APP_URL

# 3. Install & build
npm ci
npx prisma generate
npx prisma migrate deploy  # or: npx prisma db push
npm run build

# 4. Start with PM2
pm2 start npm --name "amarktai-network" -- start
pm2 save
pm2 startup

# 5. Configure Nginx (see below)
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable SSL with Certbot:

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Redeploy

```bash
cd /var/www/amarktai-network
bash deploy.sh
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Min 32-char secret for iron-session |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the app |

---

## Database Setup

```bash
# Push schema (dev / first deploy)
npm run db:push

# Run migrations (production with migration history)
npx prisma migrate deploy

# Open Prisma Studio (dev only)
npm run db:studio
```

---

## Post-Deploy Checks

- [ ] Site loads at public URL
- [ ] Contact form submits successfully
- [ ] Waitlist form submits successfully
- [ ] Admin login works at `/admin/login`
- [ ] Dashboard loads after login
- [ ] Session persists correctly
- [ ] Hidden `show admin` reveal works on public pages
- [ ] SSL certificate active
- [ ] PM2 process auto-restarts on reboot

---

## Apps in the Ecosystem

| App | Status |
|---|---|
| Amarktai Crypto | Invite Only |
| Amarktai Forex | Invite Only |
| Faith Haven | In Development |
| Learn Digital | In Development |
| Jobs SA | Coming Soon |
| Kinship | In Development |
| Amarktai Secure | Coming Soon |
| Crowd Lens | Coming Soon |

---

## License

Proprietary — Amarktai Network © 2025. All rights reserved.
