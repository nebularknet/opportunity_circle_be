# Opportunity Circle Backend

Industrial-grade backend for a two-sided marketplace connecting organizations with seekers.

## Tech Stack
- Node.js (ESM)
- Express
- MongoDB (Mongoose)
- JWT (Auth)
- Cloudinary (Media)
- Nodemailer (Email)
- Zod (Validation)
- Docker

## Getting Started

### Prerequisites
- Node.js v20+
- MongoDB
- Docker (Optional)

### Installation
1. Clone the repo
2. `cd backend`
3. `npm install`
4. Configure `.env` (use `.env.example` as template)
5. `npm run dev`

### Docker
```bash
docker-compose up --build
```

## API Features
- **Multi-role Auth**: Seeker, Publisher, Admin.
- **Seeker Onboarding**: 3-step personalized onboarding flow with preference synchronization.
- **Seeker Profiles**: Professional profile management with Cloudinary image upload integration.
- **Opportunity Feed**: Filtered and paginated opportunity delivery for seekers.
- **I18n**: Support for multi-language content.
- **Robust Validation**: Zod-powered schema validation.
- **Traceability**: x-correlation-id in all requests.
- **Soft Delete**: Data integrity preserved through soft deletes.

## Documentation
Detailed API documentation can be found in `docs/API_ENDPOINTS.md`.
