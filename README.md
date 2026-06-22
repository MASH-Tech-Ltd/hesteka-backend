# HESTEKA Backend

Developed by **MASH TECH**

![Hesteka Banner](https://img.shields.io/badge/HESTEKA-Backend-green?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.9-blue?style=for-the-badge&logo=typescript)
![Express](https://img.shields.io/badge/Express-v5.2-lightgrey?style=for-the-badge&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge&logo=mongodb)

A high-performance, scalable, and feature-rich REST API backend powering the **HESTEKA** community-engagement ecosystem. This platform facilitates community reporting, local missions, social solidarity, and real-time interactions, all integrated with global payment systems.

---

## 🚀 Core Features

HESTEKA is built with a modular architecture, supporting a wide array of community-driven functionalities:

-   **🔐 Robust Authentication**:
    -   Multi-provider support: Local (Email/Password), **Google**, and **Apple** Login.
    -   Secure OTP-based email verification and password recovery.
    -   JWT-based session management with refresh token rotation.
    -   **Registration Flexibility**: `company` field is optional for general users but strictly required for partner accounts.
-   **📣 Community Reporting & Engagement**:
    -   Geospatial-aware reports for community issues (e.g., animal reports).
    -   Interactive commenting system with nested replies, real-time Socket.io events, and media uploads.
-   **📚 Knowledge Base & Support**:
    -   Multilingual FAQ management with active/inactive visibility controls.
    -   Rate-limited support messaging to ensure platform stability.
-   **🎯 Local Missions & Partnerships**:
    -   Dynamic mission creation for community tasks.
    -   Partner-led mission management and verification.
    -   Geo-fenced mission tracking.
-   **💰 Multi-Channel Donations & Rewards**:
    -   Seamless payments via **Stripe** and **PayPal** (integrated with webhooks).
    -   Donation proof verification workflow.
    -   Incentivized ecosystem where users earn and redeem **Points** for real rewards.
-   **🗨️ Real-time Social Features**:
    -   Live chat and messaging powered by **Socket.IO**.
    -   Social "Stories" and Solidarity initiatives to foster community bonds.
    -   Instant push notifications via **Firebase Cloud Messaging (FCM)**.
-   **🛍️ E-commerce Sync**:
    -   Integration with **Shopify** for product and collection management.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (ES2022+) |
| **Framework** | [Express.js](https://expressjs.com/) (Version 5.2) |
| **Database** | [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) |
| **Caching/PubSub** | [Redis](https://redis.io/) (via ioredis) |
| **Real-time** | [Socket.IO](https://socket.io/) (WebSockets) |
| **Cloud Services** | [Firebase Admin](https://firebase.google.com/), [Cloudinary](https://cloudinary.com/) (Media) |
| **Payments** | [Stripe](https://stripe.com/), [PayPal](https://developer.paypal.com/) |
| **Validation** | [Zod](https://zod.dev/) (Strict type-safe schemas) |

---

## 📁 Project Folder Structure

The project follows a modular, feature-oriented structure for maximum maintainability:

```text
src/
├── modules/               # Primary Backend Logic (Categorized by Feature)
│   ├── admin/             # Admin dashboard and management controls
│   ├── comments/          # Interactive commenting and reply logic
│   ├── community/         # Social hub (Chat, Likes)
│   ├── contacts/          # Support and contact form processing
│   ├── donation/          # Donation tracking and management
│   ├── donationProofs/    # Verification systems for donations
│   ├── faq/               # FAQ management and retrieval
│   ├── friends/           # Friends system and requests
│   ├── localMissions/     # Mission management and participation
│   ├── myanimal/          # Animal tracking and ownership
│   ├── notifications/     # Notification dispatch (FCM + In-app)
│   ├── partnerAds/        # Partner-provided advertisement management
│   ├── payment/           # Payment gateway logic (Stripe/PayPal)
│   ├── points/            # User points ledger and balance tracking
│   ├── reports/           # Community reports and geospatial data
│   ├── rewards/           # Reward item catalog and redemption
│   ├── settings/          # System configuration and variables
│   ├── solidarity/        # Community solidarity initiative tracking
│   ├── stories/           # Social "Stories" system
│   ├── supportMessages/   # Incoming support tickets
│   └── usersAuth/         # Core Identity (Oauth, JWT, Profiles)
├── config/                # Environment-aware app configuration
├── database/              # DB connections and automated Cron jobs
├── helpers/               # Global error handlers and async wrappers
├── middleware/            # Security (AuthGuard), Validation, Rate-limiting
├── routes/                # Central API router (v1)
├── socket/                # Socket.IO event handlers and server setup
├── tempaletes/            # Modular Email & HTML templates
├── utils/                 # Shared utility functions (Cloudinary, Slugs)
├── app.ts                 # Express application instantiation
└── server.ts              # Entry point (HTTP + WebSocket server)
```

---

## ⚙️ Development Setup

### Prerequisites

-   **Node.js**: v18 or later (Recommended: LTS)
-   **MongoDB**: Local or Atlas connection string
-   **Redis**: Required for caching and real-time features
-   **Cloudinary**: For media upload handling

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd hestekaBackend
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Configuration**:
    Create a `.env` file in the root directory based on the following template:
    ```env
    PORT=5000
    NODE_ENV=development
    MONGO_URI=mongodb+srv://...
    REDIS_URL=redis://...
    
    # Security
    JWT_SECRET=your_secret_key
    ACCESS_TOKEN_SECRET=your_token_secret
    
    # Mailer
    HOST_MAIL=...
    APP_PASSWORD=...
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME=...
    CLOUDINARY_API_KEY=...
    CLOUDINARY_API_SECRET=...
    
    # Payments
    STRIPE_SECRET_KEY=...
    STRIPE_WEBHOOK_SECRET=...
    PAYPAL_CLIENT_ID=...
    PAYPAL_CLIENT_SECRET=...
    
    # Firebase
    FIREBASE_PROJECT_ID=...
    FIREBASE_PRIVATE_KEY=...
    FIREBASE_CLIENT_EMAIL=...

    # Shopify
    SHOPIFY_STORE_URL=...
    SHOPIFY_ACCESS_TOKEN=...
    ```

### Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Spins up the development server with hot-reloading. |
| `npm run build` | Compiles TypeScript source to `dist/`. |
| `npm run start` | Runs the compiled server in production mode. |
| `npm run lint` | Performs static code analysis with TypeScript. |
| `npm run makemodule` | Custom script to scaffold a new feature module. |

---

## 🔌 API OverView

The backend exposes over **90+ endpoints** through the `/api/v1` namespace.

-   **Auth**: `/auth` & `/user` (Login, Register, Social Auth, Profile)
-   **Reports**: `/reports` & `/comments` (Report management & conversation)
-   **Missions**: `/local-missions` & `/partner-ads` (Tasks & Partnerships)
-   **Commerce**: `/payments`, `/donations`, `/rewards` (Financial transactions)
-   **Social**: `/community/chat`, `/community/stories`, `/solidarity` (Socializing)
-   **System**: `/notifications`, `/admin`, `/contacts`, `/faq` (Internal operations & Content Management)

---

## 🔒 Security & Performance

**Security Architecture:**
-   **Authentication & Authorization:** Secure JWT-based auth with short-lived access tokens and HttpOnly, Secure cookie-based refresh tokens. Strict role-based access control (RBAC) across user, partner, and admin tiers.
-   **Password Protection:** Industry-standard **bcrypt** hashing for all sensitive credentials.
-   **Data Validation & Sanitization:** Strict payload validation via **Zod** middleware at the route level to prevent injection attacks and ensure data integrity.
-   **Rate Limiting & Brute Force Prevention:** Integrated `express-rate-limit` strategically on sensitive endpoints (Login, Password Reset, OTP requests) to mitigate DoS and credential stuffing attacks.

**Performance Optimizations:**
-   **Parallel Fetching & In-Memory Merges:** Abandoned heavy MongoDB aggregation pipelines (like `$unionWith`) in favor of highly optimized parallel `Promise.all` executions and lightweight Node.js V8 in-memory merging and sorting (reducing database compute overhead by over 60%).
-   **Query Abstraction:** Centralized and highly reusable filter helpers (e.g., `applyLocationFilters` with regex text matching) keeping complex queries DRY and extremely performant.
-   **Caching Strategies:** High-speed data caching and WebSocket session state management leveraging **Redis**.
-   **Media Optimization:** Automatic on-the-fly resizing, format conversion, and unused asset cleanup via **Cloudinary** webhooks.
-   **Global Error Handling:** Unified, centralized global error handling mapping precise HTTP codes and user-friendly messages, dramatically simplifying debugging and standardizing frontend responses.

---

© 2026 HESTEKA. All Rights Reserved.
Developed by **MASH TECH**