<h1 align="center">
  <br>
  <a href="https://github.com/ankaboot-source/"><img src="/frontend/public/icons/favicon-128x128.png" alt="Ankaboot" width="200"></a>
  <br>
  Ankaboot
  <br>
  <br>
</h1>
<h4 align="center">The inbox email addresses extractor and qualifier</h4>
<p align="center">
  <a href="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml"><img src="https://github.com/ankaboot-source/leadminer/actions/workflows/Deploy.yml/badge.svg?branch=main" alt="Build & Deploy"></a>
  <img src="https://img.shields.io/badge/Coverage-87.9%25-yellow.svg?style=flat" alt="Lines"></a>
</p>
<br>

# Leadminer

Leadminer is a tool to mine and transmute passive contacts from your own data sources (email mailbox, social networks) into organic and qualified leads.

## Installation

### Developement mode:
Dependencies:
* nodejs (version 14 or higher)
* postgresql
* redis

The following instructions are for setting up leadminer manually in an alpine docker container. Installing locally should be similar, please refer to your distribution instructions for correct package managment and for setting up redis and postgresql.

Start a docker container
```shell
~# docker run -p 8080:8080 -it alpine ash
```
**Note**: For alpine linux, it's a good practice to `source /etc/profile` before starting
Install the needed dependencies
```shell
apk add git npm postgresql redis
```
Here are the instructions of setting up postgreSQL on alpine. From [Installing postgreSQL on alpine guide by aem.run](https://aem.run/posts/2021-05-30-installing-postgresql-on-alpine-rpi/) 
```shell
~# mkdir /run/postgresql
~# chown postgres:postgres /run/postgresql
~# mkdir /var/lib/postgresql/data
~# chown postgres:postgres /var/lib/postgresql/data
~# chmod 0700 /var/lib/postgresql/data
~# su - postgres
~$ initdb -D /var/lib/postgresql/data
~$ pg_ctl start -D /var/lib/postgresql/data
~$ exit
```
Start the redis server in the background.
```shell
redis-server &>/var/log/redis/log.txt &
```
**Note**: To check that the server is running, run `redis-cli` and execute `ping`.
It is nether possible nor recommended to run this as root. Quasar node module does not work with root previlages. So we need to setup a new user account.
```shell
~# adduser user
~# su user
```
Clone the repository
```shell
~$ git clone https://github.com/ankaboot-source/leadminer
```
A terminal multiplexer can be used to execute both the frontend and the backned. You can also setup a docker container with `-d --name` to have it reused without reinitializing the setup.
Enter both the frontend and the backend directories and execute `npm i` to install the needed modules. Then execute `npm start` to start both the backend and the frontend.

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
