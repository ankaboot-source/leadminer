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
- 💎✒️ Enrich contacts with signature extraction
- 📤📇 Export to CSV, VCards or Google Contacts
- 📧🚀 Send email campaigns to your contacts using your own email with analytics

## 📑 Table of contents

- [📦 How to run locally?](#-how-to-run-locally)
  - [Prerequisites](#prerequisites)
  - [Clone the repository](#clone-repo)
  - [Generate environment variables](#generate-env)
  - [Start Supabase locally](#running-with-supabase-locally)
  - [Start Redis](#start-redis)
  - [Start all services](#start-services)
  - [Launch the app](#launch-app)
  - [Setup third-party services (optional)](#setup-third-party-services)
- [🤝 Contributing](#-contributing)
- [🎯 Roadmap](#-roadmap)
- [🛠️ Support](#️-support)
- [📜 License](#-license)

## 📦 How to run locally?

This section describes the recommended local setup only.

> Note: this project integrates with third-party services for email cleaning and enrichment. You can run locally with mocks first, then plug real providers later.

<div>
    <strong style="display: inline-block;" id="prerequisites">
  	Prerequisites:
	</strong>
    Make sure all the prerequisites are installed on your system
</div>

```
node -v
npm -v
bun -v
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

Run the command below to generate pre-configured `.env` files for local development.

- The script copies `.env.dev` when available.
- If `.env.dev` is missing, it falls back to `.env.example`.
- It prepares `.env` files for `./frontend`, `./backend`, `./micro-services/emails-fetcher`, and `./supabase/functions`.

```bash
npm run dev:generate-env
```

<strong style="display: inline-block;" id="running-with-supabase-locally">
  3. Start Supabase locally:
</strong>

```sh
npm run dev:supabase
```

<div>
<strong style="display: inline-block;" id="start-redis">
  4. Start Redis:
</strong>

If you prefer to run a Redis container, use the command below. Otherwise, ensure Redis is installed on your machine and skip this step.

> Note: if you encounter issues connecting to the Redis container, update `REDIS_HOST` in your backend `.env`.

```sh
docker-compose -f docker-compose.dev.yml up -d
```

</div>

<div>
<strong style="display: inline-block;" id="start-services">
  5. Start all services:
</strong>

Start frontend, backend, workers, micro-service fetcher, and Supabase edge functions:

```sh
npm run dev:all
```

</div>

<details>
<summary>
    <strong style="display: inline-block;" id="setup-third-party-services">
      6. Setup third-party services (optional)
    </strong>
</summary>

External services for email verification and LLM-based signature extraction.

- **[Reacher](https://reacher.email/):** Use the SaaS version or self-host. Refer to [Reacher's documentation](https://help.reacher.email/) for setup.

  > **Note:** Refer to [./backend/.env.dev](./backend/.env.dev)

- **[MailerCheck](https://mailercheck.com):** Sign up, then update `MAILERCHECK_API_KEY` in the `.env` file.

  > Refer to [./backend/.env.dev](./backend/.env.dev) for guidance.

- **[Zero bounce](https://www.zerobounce.net/):** Sign up, then update `ZEROBOUNCE_API_KEY` in the `.env` file.

  > Refer to [./backend/.env.dev](./backend/.env.dev) for guidance.

- **[OpenRouter](https://openrouter.ai/):** Used for LLM-powered email signature extraction.  
   Add your API key as `SIGNATURE_OPENROUTER_API_KEY` in the `.env` file.

  > Refer to [./backend/.env.dev](./backend/.env.dev) for guidance.

  </details>

<strong style="display: inline-block;" id="launch-app">
7. Launch the app:
</strong>

Finally, open: http://localhost:8082/

## 🤝 Contributing

Thank you for taking the time to contribute! Please refer to our [CONTRIBUTING.md](https://github.com/ankaboot-source/leadminer/blob/main/CONTRIBUTING.md) for guidelines and more information on how to get started.

## 🎯 Roadmap

For any specific requests or suggestions regarding the roadmap, please feel free to contact [ankaboot professional services](mailto:contact@ankaboot.fr) or check the open issues for ongoing discussions and updates.

## 🛠️ Support

If you encounter any issues, please check the [issues tab](https://github.com/ankaboot-source/leadminer/issues) to see if it has already been reported and resolved. Ensure that you are using the latest version before reporting an issue. If the problem persists, feel free to [open a new issue](https://github.com/ankaboot-source/leadminer/issues/new).

Please note that this app is provided for free and without any guarantee or official support. If you require additional assistance, you can contact [ankaboot professional services](mailto:contact@ankaboot.fr) for help.

## 📜 License

This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
