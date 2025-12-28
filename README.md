# Novo API Gateway - Usage-Based Billing

A complete usage-based billing API gateway with Stripe metered billing for the Novo marketing system.

## Architecture

```
User Registers → Generate API Key → Stripe Subscription Created
        ↓
    User Makes API Call (with API Key)
        ↓
    Authentication Check → Usage Logged → Process Request
        ↓
    Report Usage to Stripe (metered billing)
        ↓
    Monthly Invoice → User Billed Based on Usage
```

## Features

- **User Registration** - Automatic Stripe customer and subscription creation
- **API Key Authentication** - Secure SHA-256 hashed keys with prefix display
- **Usage Tracking** - Real-time logging of all API calls
- **Metered Billing** - Automatic usage reporting to Stripe
- **Rate Limiting** - Global and per-user rate limits
- **Billing Portal** - Self-service subscription management
- **Webhook Handling** - Automatic subscription status sync

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Stripe secret key:
```
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### 3. Setup Stripe Products

```bash
npm run setup-stripe
```

This creates the metered product and price in Stripe. Copy the output to your `.env` file.

### 4. Start the Server

```bash
npm run dev
```

## API Usage

### Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

Response includes your API key (save it - shown only once!):
```json
{
  "apiKey": {
    "key": "nk_a1b2c3d4...",
    "note": "Save this API key securely. It will not be shown again."
  }
}
```

### Make API Calls

```bash
# Using Authorization header
curl http://localhost:3000/api/v1/insights \
  -H "Authorization: Bearer nk_your_api_key"

# Using X-API-Key header
curl http://localhost:3000/api/v1/analytics \
  -H "X-API-Key: nk_your_api_key"

# Using query parameter
curl "http://localhost:3000/api/v1/insights?api_key=nk_your_api_key"
```

### Check Usage

```bash
curl http://localhost:3000/billing/usage \
  -H "Authorization: Bearer nk_your_api_key"
```

### Access Billing Portal

```bash
curl -X POST http://localhost:3000/billing/portal \
  -H "Authorization: Bearer nk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "http://localhost:3000"}'
```

## Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user, get API key |
| POST | `/auth/login` | Login, list API keys |
| POST | `/auth/api-keys` | Generate new API key |
| GET | `/auth/api-keys` | List your API keys |
| DELETE | `/auth/api-keys/:id` | Revoke an API key |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/billing/usage` | Current usage & estimated cost |
| GET | `/billing/usage/endpoints` | Usage by endpoint |
| GET | `/billing/invoices` | Invoice history |
| POST | `/billing/portal` | Stripe billing portal URL |
| GET | `/billing/subscription` | Subscription details |
| POST | `/billing/subscription/cancel` | Cancel subscription |

### Protected API (Billed)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/insights` | Marketing insights |
| POST | `/api/v1/audience/analyze` | Analyze audience |
| POST | `/api/v1/campaign/generate` | Generate campaign |
| POST | `/api/v1/notifications/send` | Send notification |
| GET | `/api/v1/analytics` | Get analytics |
| POST | `/api/v1/bulk/process` | Bulk processing |

## Pricing Configuration

Edit `.env` to customize pricing:

```env
COST_PER_CALL=0.001      # $0.001 per API call
FREE_TIER_CALLS=1000     # First 1000 calls free per month
```

## Webhook Setup

For production, configure Stripe webhooks:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/webhooks/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the webhook secret to `.env`

## Project Structure

```
src/
├── config/          # Configuration
├── db/
│   ├── schema.js    # Database setup
│   └── models/      # User, ApiKey, Usage models
├── middleware/
│   └── apiGateway.js  # Auth & usage tracking
├── routes/
│   ├── auth.js      # Authentication endpoints
│   ├── billing.js   # Billing endpoints
│   ├── api.js       # Protected API endpoints
│   └── webhook.js   # Stripe webhooks
├── services/
│   ├── stripe.js    # Stripe integration
│   ├── webhook.js   # Webhook handler
│   └── usageReporter.js  # Background usage reporting
├── scripts/
│   ├── setup-stripe.js   # Initial Stripe setup
│   └── report-usage.js   # Manual usage reporting
└── index.js         # Main entry point
```

## Scripts

```bash
npm start           # Start production server
npm run dev         # Start with auto-reload
npm run setup-stripe # Create Stripe products
npm run report-usage # Manually report usage
```
