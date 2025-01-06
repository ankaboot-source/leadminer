[![Maintainability](https://api.codeclimate.com/v1/badges/42e68c56bc3ce2b1f59b/maintainability)](https://codeclimate.com/repos/63f7174b3d043100a803ee03/maintainability)

<div>
  <div align="center">
    <img width="90" height="90" src="https://app-qa.leadminer.io/icons/pickaxe.svg" alt="Leadminer Logo">
  </div>
  <h1 align="center">Leadminer</h1>
  <div align="center">
    <p>
    A tool to mine and transmute raw and passive emails from your own email mailbox into actionable and qualified contacts.
    </p>

  </div>
</div>

## ✨ Features

- ⛏️📧 Extract contacts from your mailbox
- 🧹💌 Clean your email list

## 📑 Table of contents

- [📦 How to run?](#-how-to-run)
  - [Prerequisites](#prerequisites)
  - [Clone the repository](#clone-repo)
  - [Generate environment variables](#generate-env)
  - [Setup third-party services (optional)](#setup-third-party-services)
  - [Running with Supabase SaaS](#running-with-supabase-saas)
  - [Running with Supabase locally](#running-with-supabase-locally)

- [🤝 Contributing](#-contributing)
- [🎯 Roadmap](#-roadmap)
- [🛠️ Support](#️-support)
- [📜 License](#-license)

## 📦 How to run?

To give it a try without the hassle of installation, [simply use leadminer.io](https://app.leadminer.io/auth/signup). For development purposes, jump directly to [Running with Supabase locally](#running-with-supabase-locally).

> Note that this project integrates with third-party services for email cleaning and enrichment.

<div>
    <strong style="display: inline-block;" id="prerequisites">
  	Prerequisites:
	</strong>
    Make sure all the prerequisites are installed on your system
</div>

```
node -v
npm -v
docker -v
docker-compose -v
```

<div>
    <strong style="display: inline-block;" id="clone-repo">
     1. Clone the repository & install dependencies:
    </strong>
</div>

```bash
git clone https://github.com/ankaboot-source/leadminer
cd leadminer
npm run install-deps
```

<div>
    <strong style="display: inline-block;" id="generate-env">
     2. Generate environment variables:
    </strong>
</div>

Run the bellow commands to generate a preconfigured `.env` file with credentials and API mocks, optimized for local development and testing. Expect 3 `.env` files created in `./backend` `./frontend` `./supabase/functions`

> If you encounter OAuth issues during sign-in and sign-up, Contact team@ankaboot.io to add your email to the whitelist or refer to [Running with Supabase SaaS](#running-with-supabase-saas) to learn how you can create your own OAuth credentials.

```bash
./generate_env env.master.dev
cp ./supabase/functions/.env.dev ./supabase/functions/.env
```

<details>
<summary>
    <strong style="display: inline-block;" id="setup-third-party-services">
      3. Setup third-party services (optional)
    </strong>
</summary>

External services for email verification.

- **[Reacher](https://reacher.email/):** Use the SaaS version or self-host. Refer to [Reacher's documentation](https://help.reacher.email/) for setup.

  > **Note:** Refer to [.env.master.prod](./.env.master.prod) and [.env.master.dev](./.env.master.dev) according to your environment

- **[MailerCheck](https://mailercheck.com):** Sign up, then update `MAILERCHECK_API_KEY` in the `.env` file.

  > Refer to [.env.master.prod](./.env.master.prod) for guidance.

- **[Zero bounce](https://www.zerobounce.net/):** Sign up, then update `ZEROBOUNCE_API_KEY` in the `.env` file.

  > Refer to [.env.master.prod](./.env.master.prod) for guidance.

</details>

<details>
<summary><strong style="display:inline-block" id="running-with-supabase-saas">Running with Supabase SaaS</strong></summary>


1. **Setup Supabase Instance:**

   - Create an account [here](https://supabase.com/dashboard/sign-up) and create a project.

   - Obtain the following values from your dashboard:

     - **Project URL**: Found under Settings -> API in the "Project URL" section.
     - **Project API key**: Found under Settings -> API in the "Project API keys" section. Use the `service_role` secret.
     - **Project Anon key**: Found under Settings -> API in the "Project API keys" section. Use the `anon` `public` key.
     - **Postgres Connection string**: Found under Settings -> Database in the "Connection string" section. Select the URI option.

   - Configuring authentication with OAuth:

     > **Note:** Currently, Leadminer only supports Google and Azure as third-party OAuth providers. Use "google" for the "PROVIDER_NAME" if integrating Google OAuth and "azure" if integrating Azure.

     - Enable third-party providers in your Supabase dashboard. Refer to the [documentation](https://supabase.com/docs/guides/auth#configure-third-party-providers) for instructions.
     - Under the "Social Auth" section, select the provider you want to configure and follow the provided [instructions](https://supabase.com/docs/guides/auth#providers).
     - After creating an OAuth app, go to your app dashboard and add the following URI under the "REDIRECT URI's" section: `http://localhost:8081/api/imap/mine/sources/PROVIDER_NAME/callback`.

2. **Deploy secrets, migrations, edge-functions:**

   Configure the variables inside `./supabase/functions/.env` with supabase credentials from step 1, for other variables reference the backend, frontend .env files to copy the value.

   > - https://supabase.com/docs/reference/cli/supabase-login
   > - https://supabase.com/docs/reference/cli/supabase-link
   > - https://supabase.com/docs/reference/cli/supabase-db-push
   > - https://supabase.com/docs/guides/functions/deploy
   > - https://supabase.com/docs/guides/functions/secrets

   ```bash
   npx supabase login
   npx supabase link --project-ref <supabase_project_id>
   npx supabase secrets set --env-file ./supabase/functions/.env
   npx supabase db push
   npx supabase functions deploy
   ```

3. **Start docker-compose then navigate to `localhost:8080`:**

   ```shell
   docker-compose up --build --force-recreate
   ```

</details>

<details open>
<summary><strong style="display:inline-block" id="running-with-supabase-locally">Running with Supabase locally</strong></summary>

1. **Start Supabase services:**

   ```sh
   npm run dev:supabase
   ```

2. **Start Redis services:**

   If you prefer to run a Redis container, use the command below. Otherwise, ensure Redis is installed on your machine and skip this step.

   > Note: If you encounter issues connecting to the redis container, make sure to update `REDIS_HOST` in the `.env` file.

   ```shell
   docker-compose -f docker-compose.dev.yml up
   ```

3. **Start your environment:**

   ```sh
   npx supabase functions serve
   | npm run dev:frontend
   | npm run dev:backend-api
   | npm run dev:backend-worker
   | npm run dev:backend-email-worker
   | npm run dev:backend-mock-external-services
   ```

</details>

## 🤝 Contributing

Thank you for taking the time to contribute! Please refer to our [CONTRIBUTING.md](https://github.com/ankaboot-source/leadminer/blob/main/CONTRIBUTING.md) for guidelines and more information on how to get started.

## 🎯 Roadmap

For any specific requests or suggestions regarding the roadmap, please feel free to contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) or check the open issues for ongoing discussions and updates.

## 🛠️ Support

If you encounter any issues, please check the [issues tab](https://github.com/ankaboot-source/leadminer/issues) to see if it has already been reported and resolved. Ensure that you are using the latest version before reporting an issue. If the problem persists, feel free to [open a new issue](https://github.com/ankaboot-source/leadminer/issues/new).

Please note that this app is provided for free and without any guarantee or official support. If you require additional assistance, you can contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) for help.

## 📜 License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
