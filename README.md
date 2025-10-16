[![Known Vulnerabilities](https://snyk.io/test/github/ankaboot-source/leadminer/badge.svg?targetFile=package.json)](https://snyk.io/test/github/ankaboot-source/leadminer?targetFile=package.json)
[![Maintainability](https://qlty.sh/badges/a42a3f7d-f1a1-4cf3-92aa-c14c33cea8a2/maintainability.svg)](https://qlty.sh/gh/ankaboot-source/projects/leadminer)
[![Mozilla Observatory Score](https://img.shields.io/badge/Web%20Security-A%2B-2ea44f)](https://developer.mozilla.org/en-US/observatory/analyze?host=App.leadminer.io)
[![DeepSource](https://app.deepsource.com/gh/ankaboot-source/leadminer.svg/?label=code+coverage&show_trend=false&token=M4B7pZCjFk2wl_EJpgQ9f-le)](https://app.deepsource.com/gh/ankaboot-source/leadminer/)

<div>
  <div align="center">
    <img width="90" height="90" src="https://raw.githubusercontent.com/ankaboot-source/leadminer/e64bd4e5c06328eeab8df0fdf997a5eaa08fc0e1/frontend/src/public/icons/pickaxe.svg" alt="Leadminer Logo">
  </div>
  <h1 align="center">Leadminer</h1>
  <div align="center">
    <p>
    Extract, clean and enrich email addresses from your own mailbox.
    </p>

  </div>
</div>

## ✨ Features

- ⛏️📧 Extract contacts from your mailbox
- 🧹💌 Clean your email list
- 💎✒️ Enrich contacts details with signature extraction

## 📑 Table of contents

- [📦 How to run?](#-how-to-run)
  - [Prerequisites](#prerequisites)
  - [Clone the repository](#clone-repo)
  - [Generate environment variables](#generate-env)
  - [Setup third-party services (optional)](#setup-third-party-services)
  - [Running with Supabase](#running-with-supabase)
  - [Launch the app](#launch-app)
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

Run the below commands to generate a pre-configured `.env` file with credentials and API mocks, optimized for local development and testing. Expect 3 `.env` files created in `./backend` `./frontend` `./supabase/functions`

> If you encounter OAuth issues during sign-in and sign-up, Contact team@ankaboot.io to add your email to the whitelist or refer to [Running with Supabase SaaS](#running-with-supabase-saas) to learn how you can create your own OAuth credentials.

```bash
npm run dev:generate-env
```

<details>
<summary>
    <strong style="display: inline-block;" id="setup-third-party-services">
      3. Setup third-party services (optional)
    </strong>
</summary>

External services for email verification.

- **[Reacher](https://reacher.email/):** Use the SaaS version or self-host. Refer to [Reacher's documentation](https://help.reacher.email/) for setup.

  > **Note:** Refer to [./backend/.env.dev](./backend/.env.dev)

- **[MailerCheck](https://mailercheck.com):** Sign up, then update `MAILERCHECK_API_KEY` in the `.env` file.

  > Refer to [./backend/.env.dev](./backend/.env.dev) for guidance.

- **[Zero bounce](https://www.zerobounce.net/):** Sign up, then update `ZEROBOUNCE_API_KEY` in the `.env` file.

  > Refer to [./backend/.env.dev](./backend/.env.dev) for guidance.

</details>

<div>
<strong style="display: inline-block;" id="running-with-supabase">
  4. Running with Supabase
</strong>
    <br>
    You could either set-up leadminer using Supabase locally or Supabase SaaS. We recommend Supabase locally for now.
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

3. **Start docker-compose :**

   ```shell
   docker-compose up --build --force-recreate -d
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
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Start your environment:**

   Start frontend, backend and supabase edge-functions services:

   ```sh
   npm run dev:all
   ```
      </details>
   </div>

<strong style="display: inline-block;" id="launch-app">
5. Launch the app:
</strong>

Finally, launch the app at: http://localhost:8082/

## 🤝 Contributing

Thank you for taking the time to contribute! Please refer to our [CONTRIBUTING.md](https://github.com/ankaboot-source/leadminer/blob/main/CONTRIBUTING.md) for guidelines and more information on how to get started.

## 🎯 Roadmap

For any specific requests or suggestions regarding the roadmap, please feel free to contact [ankaboot professional services](mailto:contact@ankaboot.fr) or check the open issues for ongoing discussions and updates.

## 🛠️ Support

If you encounter any issues, please check the [issues tab](https://github.com/ankaboot-source/leadminer/issues) to see if it has already been reported and resolved. Ensure that you are using the latest version before reporting an issue. If the problem persists, feel free to [open a new issue](https://github.com/ankaboot-source/leadminer/issues/new).

Please note that this app is provided for free and without any guarantee or official support. If you require additional assistance, you can contact [ankaboot professional services](mailto:contact@ankaboot.fr) for help.

## 📜 License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
