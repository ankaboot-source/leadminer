[![DeepSource](https://deepsource.io/gh/ankaboot-source/leadminer.svg/?label=active+issues&show_trend=true&token=M4B7pZCjFk2wl_EJpgQ9f-le)](https://deepsource.io/gh/ankaboot-source/leadminer/?ref=repository-badge) </a>[![Maintainability](https://api.codeclimate.com/v1/badges/42e68c56bc3ce2b1f59b/maintainability)](https://codeclimate.com/repos/63f7174b3d043100a803ee03/maintainability)

# ⛏ Leadminer

Leadminer is a tool to mine and transmute raw and passive emails from your own email mailbox into actionable and qualified contacts.

## Features

- ⛏️📧 Contacts extracting from your mailbox
- 🧹💌 Email list cleaning
- 🧑🏾‍🔬💎 Enrich your contact list

## How to run?

To run Leadminer, follow these steps:

### Supabase instance:

- Create a Supabase account [here](https://supabase.com/dashboard/sign-up) and create a project.
- Obtain the following three values from your dashboard:
  - **Project URL**: Found under Settings -> API in the "Project URL" section.
  - **Project API key**: Found under Settings -> API in the "Project API keys" section. Use the `service_role` secret.
  - **Project Anon key**: Found under Settings -> API in the "Project API keys" section. Use the `anon` `public` key.
  - **Postgres Connection string**: Found under Settings -> Database in the "Connection string" section. Select the URI option.

### Configure OAuth:

- Enable third-party providers in your Supabase dashboard. Refer to the [documentation](https://supabase.com/docs/guides/auth#configure-third-party-providers) for instructions.
- Create a third-party provider OAuth app:
  - Under the "Social Auth" section, select the provider you want to configure and follow the provided [instructions](https://supabase.com/docs/guides/auth#providers).
  - After creating an OAuth app, go to your app dashboard and add the following URI under the "REDIRECT URI's" section: `http://localhost:8081/api/imap/mine/sources/PROVIDER_NAME/callback`.

> **Note:** Currently, Leadminer only supports Google and Azure as third-party OAuth providers. Use "google" for the "PROVIDER_NAME" if integrating Google OAuth and "azure" if integrating Azure.

### Configure Email Verification:

We use [Reacher](https://reacher.email/) and [MailerCheck](https://mailercheck.com) as part of our email verification process. You can configure either one or both.

- **Configure Reacher:**

You can either use the SaaS version of Reacher or self-host it. Follow [Reacher's official documentation](https://help.reacher.email/) for detailed configuration instructions.

> **Note:** Leadminer is configured by default to use a Mock server of Reacher for ease of use. 
>
> Check the `### REACHER ###` section in the `.env` file.

- **Configure MailerCheck:**

MailerCheck is a SaaS solution. Create an account and add the API key to the environment variables. see `.env.example` detailed instructions.

### Run using docker-compose

Docker is the recommended solution for self-hosting Leadminer thanks to its convenience and ease of use.

1. Clone the repository and enter `leadminer` folder

1. Copy [.env.example](/.env.example) to `.env` and add the missing required environment variables

   ```sh
   cp .env.example .env
   ```

1. Start docker-compose:

   ```sh
   docker-compose up --build --force-recreate
   ```

1. Navigate to `localhost:8080`.

### Running the Project Locally (Dev mode)

To run the project in your local environment, follow the steps below:

1. Install the required dependencies by running the following command:

   ```sh
   npm run install-deps
   ```

2. Start the Supabase services and take note of the Supabase project token for the next step. Run the following command:

   ```sh
   npm run dev:supabase
   ```

3. Create the `.env` files by executing the command below.

   > This will create `.env` files in the `/frontend` and `/backend` directories. Make sure to set the missing required variables in these files.

   ```sh
   cp /frontend/.env.example /frontend/.env && cp /backend/.env.example /backend/.env
   ```

4. Start your environment by running the following commands:

   ```sh
   # Start the Redis container (You can skip this step if you want to use your local instance)
   docker-compose -f docker-compose.dev.yml up
   
   # Start the backend in development mode
   npm run dev:backend-api
   npm run dev:backend-worker
   
   # Start the frontend in development mode
   npm run dev:frontend
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

### Contributing

Thank you for taking the time to contribute! Please refer to our [CONTRIBUTING.md](https://github.com/ankaboot-source/leadminer/blob/main/CONTRIBUTING.md) for guidelines and more information on how to get started.

## Roadmap

- [ ] New sources : LinkedIn, Instagram, Facebook Messenger
- [ ] Enrich data : Get more relevant and actionable information about your contacts
- [ ] Marketing automation : send emails directly from Leadminer with personalized templates

For any specific requests or suggestions regarding the roadmap, please feel free to contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) or check the open issues for ongoing discussions and updates.

## Support

If you encounter any issues, please check the [issues tab](https://github.com/ankaboot-source/leadminer/issues) to see if it has already been reported and resolved. Ensure that you are using the latest version before reporting an issue. If the problem persists, feel free to open a new issue.

Please note that this app is provided for free and without any guarantee or official support. If you require additional assistance, you can contact [ankaboot professional services](https://chat.openai.com/contact@ankaboot.fr) for help.

## License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
