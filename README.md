[![Build & Deploy](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml/badge.svg?branch=main)](https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml)
![Lines](https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat)

# Leadminer

Leadminer is a tool to mine and transmute passive contacts from your own data sources (email mailbox, social networks) into organic and qualified leads.

## Installation

#### Developement mode:

Vuejs version 3 and nodejs version 14 or above must first be installed.

Then look through the frontend and backend Readme folders to setup each environment.

```bash
TODO: make or sh script to setup in one command the full project
```

#### env variables

```bash
POSTGRES_DB = "postgres"
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = ""
EMAIL_IMAP = "leadminer@leadminer.io"
PASSWORD_IMAP = "abcd123"
HOST_IMAP = "imap.domain.com"
GOOGLE_IMAP_HOST = "imap.gmail.com"
NEWSLETTER = ["list-unsubscribe", "list-id", "list"]
TRANSACTIONAL = ["feedback-id", "x-feedback-id","x-Mandrill-User", "x-mailer","X-MarketoID","X-campaignid","X-Mailgun"]
CAMPAIGN = ["x-campaignid"]
HASH_SECRET = "customhashsecret"
EX_REDIS = 259200
GG_CLIENT_ID="8656********-customclientid**********.apps.googleusercontent.com"
GG_CLIENT_SECRET="G*C*PX-*************yGHnVAnQ**********"
AUTHENTICATION_TIMEOUT=10000
CONNECTION_TIMEOUT=90000
LOG_LEVEL='debug'

```

## Usage

```bash

$ usage
$ usage

```

## Support

This app is provided for free as such with no guarantee nor support. For any kind of support, feel free to reach [ankaboot professional services](contact@ankaboot.fr).

## Roadmap

For any requests concerning the roadmap, you could either have a look on issues or for any specific request contact [ankaboot professional services](contact@ankaboot.fr).

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
This software is [dual-licensed](DUAL-LICENSE.md) under [GNU AGPL v3](LICENSE).
