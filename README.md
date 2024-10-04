[![DeepSource](https://app.deepsource.com/gh/ankaboot-source/leadminer.svg/?label=code+coverage&show_trend=true&token=M4B7pZCjFk2wl_EJpgQ9f-le)](https://app.deepsource.com/gh/ankaboot-source/leadminer/)
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
  - [Setup email-verification services](#setup-email-verification-services)
  - [Running with Supabase SaaS](#running-with-supabase-saas)
  - [Running with Supabase self-hosted](#running-with-supabase-self-hosted)
- [🤝 Contributing](#-contributing)
- [🎯 Roadmap](#-roadmap)
- [🛠️ Support](#️-support)
- [📜 License](#-license)

## 📦 How to run?

This project integrates with external services for full features. Jump directly to [set-up with supabase self-hosted](#running-with-supabase-self-hosted) for development purposes.

<details>
<summary><h3 style="display:inline-block" id="setup-email-verification-services">Setup email-verification services</h3></summary>

We use external services for email verification. Configure at least one.

- **[Reacher](https://reacher.email/):** Use the SaaS version or self-host. Refer to [Reacher's documentation](https://help.reacher.email/) for setup.

  > **Note:** Refer to [.env.master.prod](./.env.master.prod) and [.env.master.dev](./.env.master.dev) according to your environment

- **[MailerCheck](https://mailercheck.com):** Sign up, then update `MAILERCHECK_API_KEY` in the `.env` file.

  > Refer to [.env.master.prod](./.env.master.prod) for guidance.

- **[Zero bounce](https://www.zerobounce.net/):** Sign up, then update `ZEROBOUNCE_API_KEY` in the `.env` file.

  > Refer to [.env.master.prod](./.env.master.prod) for guidance.

</details>

<details>
<summary><h3 style="display:inline-block" id="running-with-supabase-saas">Running with Supabase SaaS</h3></summary>

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

   - **Install supabase-cli:**

     ```shell
     cd leadminer && npm i
     ```

   - **Deploy migrations and [edge-functions]():**

     ```shell
     # Refer to https://supabase.com/docs/reference/cli/supabase-login
     supabase login
     # Refer to https://supabase.com/docs/reference/cli/supabase-link
     supabase link --project-ref <supabase_project_id>
     # Refer to https://supabase.com/docs/reference/cli/supabase-db-push
     supabase db push
     # Refer to https://supabase.com/docs/guides/functions/deploy
     supabase functions deploy
     ```

2. **Setup Environment Variables:**

   You'll be configuring your environment variables from scratch, along with setting up all required services:

   1. Copy the production environment files [`.env.master.prod`](./.env.master.prod) [./supabase/functions/env.prod](./supabase/functions/.env.prod):

      ```shell
      cp .env.master.prod .env
      cp ./supabase/functions/.env.prod ./supabase/functions/.env
      ```

   2. Deploy your [Supabase secrets](https://supabase.com/docs/guides/functions/secrets):

      ```shell
      supabase secrets set --env-file ./supabase/functions/.env
      ```

3. **Start docker-compose then navigate to `localhost:8080`:**

   ```shell
   docker-compose up --build --force-recreate
   ```

</details>

<details open>
<summary><h3 style="display:inline-block" id="running-with-supabase-self-hosted">Running with Supabase self-hosted</h3></summary>

1.  **Install the required dependencies:**

    ```sh
    npm run install-deps
    ```

2.  **Start Supabase services:**

    > Refer to [config.toml](./supabase/config.toml) file to tweak your local supabase.

    ```sh
    npm run dev:supabase
    ```

3.  **Setup Environment Variables:**

    We provide preconfigured environment files optimized for development that includes keys, mocks, and more:

    > Note: If you encounter issues during sign-in and sign-up using OAuth, Contact team@ankaboot.io to add your email to the whitelist or refer to [Running with Supabase SaaS](#running-with-supabase-saas) to learn how you can create your own OAuth credentials.

    1.  Run the bellow commands, expect 3 `.env` files created in `./backend` `./frontend` `./supabase/functions`

        ```shell
        cp ./supabase/functions/.env.dev ./supabase/functions/.env # edge-functions variables
        npm run dev:generate-env # backend and frontend variables
        ```

4.  **Start Redis services:**

    If you prefer to run a Redis container, use the command below. Otherwise, ensure Redis is installed on your machine and skip this step.

    > Note: If you encounter issues connecting to the redis container, make sure to update `REDIS_HOST` in the `.env` file.

    ```shell
    docker-compose -f docker-compose.dev.yml up
    ```

5.  **Start your environment:**

    ```sh
    npm run dev:frontend # Start frontend
    npm run dev:backend-api	# Start backend api
    npm run dev:backend-worker # Start email extraction worker
    npm run dev:backend-email-worker # Start email verification worker
    npm run dev:backend-mock-external-services	# Start mocks for external services such as voilanorbert, mailercheck...
    ```

**Generating a new migration for schema changes:**

If you need to alter the database schema or create new tables or functions, follow these steps (while Supabase services are up):

```sh
# Start supabase services
npx supabase start

# Make your changes from supabase studio

# List the changes that you made
npx supabase db diff --use-migra

# Create a migration for the changes that you have made
npx supabase db diff --use-migra -f <name_of_migration>

# Stop supabase services once you're done
npx supabase stop
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
