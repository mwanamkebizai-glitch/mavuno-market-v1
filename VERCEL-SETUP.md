# Vercel Setup (Existing GitHub Repository)

## Current status

The existing GitHub repository is `mwanamkebizai-glitch/mavuno-market-v1`. Vercel's New Project wizard displays that repository on `main`, but its **Create** button is disabled. This did not complete a project import or create a deployment. There is no verified Vercel project or configured environment in this work.

Do not press **Deploy** until the owner has privately configured environment values and explicitly approved a preview deployment. Do not deploy production as part of this setup.

## Import settings

In the Vercel team selected for Mavuno Market:

1. Choose **Add New → Project** and import the existing repository `mwanamkebizai-glitch/mavuno-market-v1`.
2. Use repository root `.`.
3. Use the Next.js framework preset.
4. Use `npm ci` for install and `npm run build` for build. Leave the output directory at the Next.js default (`.next`).
5. Select a supported Node.js version of 20.9 or later; Node 22.x is recommended.
6. Configure environment variables before creating a deployment:
   - `NEXT_PUBLIC_SUPABASE_URL`: the existing project's project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: that project's public anon key or supported publishable key.
7. Set the values privately in Vercel Project Settings. Never paste them into chat, commit them, or set a service-role key as a client-visible `NEXT_PUBLIC_` variable.

If Vercel requires a deployment to finish creating the project, stop at the final confirmation until the owner is ready to deploy a Preview. Do not substitute placeholders or guess the project URL/key.

## Preview and production gates

1. After the owner adds the environment values, create a Preview deployment from a non-production branch and verify it loads, authenticates, and can access only the intended Supabase project.
2. Check auth redirect URLs, mobile layouts, role-specific flows, RLS behavior, manual location confirmation, and direct/off-platform payment evidence/status behavior.
3. Do not declare the application ready based on a successful build or preview alone. The migration must be reviewed/applied by the owner and role-based end-to-end tests must pass.
4. Only after explicit owner approval should the `main` branch be used for a production deployment.
5. Once Vercel provides a real domain, the owner must add that exact domain to Supabase Auth's Site URL and redirect allowlist, then retest sign-in and password recovery.

The app must continue to use only public client configuration. No payment gateway, M-Pesa API, tracking, or service-role key is part of this setup.
